import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allocateStatPoint,
  buyPotionsWithZen,
  buySkillBookWithZen,
  buyStarterEquipmentWithZen,
  calculateDerivedStats,
  CLASSES,
  craftChaosWings,
  createInitialPlayerState,
  equipItemFromInventory,
  evolveCharacterClass,
  grantExperience,
  unequipItemToInventory,
  upgradeItemWithJewel,
} from './rules';

test('initial player state spawns naked with 0 learned skills, empty inventory, and fist combat stats', () => {
  const dk = createInitialPlayerState('dark_knight');
  assert.equal(dk.classId, 'dark_knight');
  assert.equal(dk.level, 1);
  assert.equal(dk.statPoints, 15);
  assert.equal(dk.hpPotions, 3);
  assert.equal(dk.mpPotions, 3);
  assert.equal(dk.hasFirstProfQuestItem, false);
  assert.equal(dk.learnedSkills.length, 0);
  assert.equal(dk.inventory.length, 0);
  assert.equal(dk.equipped.weapon, null);
  assert.equal(dk.equipped.armor, null);
  assert.equal(dk.equipped.helm, null);
  assert.equal(dk.equipped.wings, null);
  assert.equal(dk.equipped.ring, null);
  assert.equal(dk.equipped.pendant, null);

  const stats = calculateDerivedStats(dk);
  assert.equal(stats.activeSetPieceCount, 0);
  assert.ok(stats.maxHp > 200);
  assert.ok(stats.maxDamage > stats.minDamage);
});

test('buySkillBookWithZen enforces progressive level requirements and Zen prices for skill books', () => {
  const dk = createInitialPlayerState('dark_knight');
  const skills = CLASSES.dark_knight.skills;
  assert.ok(skills[0].bookPriceZen < skills[1].bookPriceZen);
  assert.ok(skills[1].bookPriceZen < skills[2].bookPriceZen);
  assert.ok(skills[2].bookPriceZen < skills[3].bookPriceZen);
  assert.ok(skills[0].requiredLevel < skills[1].requiredLevel);
  assert.ok(skills[1].requiredLevel < skills[2].requiredLevel);
  assert.ok(skills[2].requiredLevel < skills[3].requiredLevel);

  // Cannot buy Skill 1 book at Level 1 (requires Level 3)
  const tooLowLvl = buySkillBookWithZen({ ...dk, zen: 5000 }, 'cyclone_slash');
  assert.equal(tooLowLvl.success, false);

  // Can buy Skill 1 book at Level 3 for 350 Zen
  const lvl3 = buySkillBookWithZen({ ...dk, level: 3, zen: 1000 }, 'cyclone_slash');
  assert.equal(lvl3.success, true);
  assert.equal(lvl3.nextState.zen, 1000 - 350);
  assert.ok(lvl3.nextState.learnedSkills.includes('cyclone_slash'));

  // Cannot buy duplicate skill book
  const duplicate = buySkillBookWithZen(lvl3.nextState, 'cyclone_slash');
  assert.equal(duplicate.success, false);

  // Skill 4 book requires both Level 50 and 1st Profession (classTier >= 2)
  const lvl50NoProf = buySkillBookWithZen({ ...lvl3.nextState, level: 50, zen: 15000 }, 'combo_nova');
  assert.equal(lvl50NoProf.success, false);

  const lvl50WithProf = buySkillBookWithZen(
    { ...lvl3.nextState, level: 50, classTier: 2, zen: 15000 },
    'combo_nova'
  );
  assert.equal(lvl50WithProf.success, true);
  assert.ok(lvl50WithProf.nextState.learnedSkills.includes('combo_nova'));
});

test('allocating +1 and +10 stat points at once increments attributes and increases combat power', () => {
  const initial = createInitialPlayerState('dark_wizard');
  const beforeStats = calculateDerivedStats(initial);

  // Allocate +10 points at once
  const afterTen = allocateStatPoint(initial, 'ene', 10);
  assert.equal(afterTen.statPoints, 5);
  assert.equal(afterTen.attributes.ene, initial.attributes.ene + 10);

  // Allocate +1 point
  const afterEleven = allocateStatPoint(afterTen, 'ene', 1);
  assert.equal(afterEleven.statPoints, 4);
  assert.equal(afterEleven.attributes.ene, initial.attributes.ene + 11);

  const afterStats = calculateDerivedStats(afterEleven);
  assert.ok(afterStats.maxDamage > beforeStats.maxDamage);
  assert.ok(afterStats.maxMp > beforeStats.maxMp);
});

test('1st profession evolution requires Level 50 AND dropped Quest Item, and Grand Reset requires Level 300', async () => {
  const { performGrandReset } = await import('./rules');
  const initial = createInitialPlayerState('fairy_elf');
  const { nextState, leveledUp } = grantExperience(initial, 800);
  assert.equal(leveledUp, true);
  assert.ok(nextState.level >= 2);

  // Evolution fails below Level 50
  const lowLevelEvo = evolveCharacterClass(nextState);
  assert.equal(lowLevelEvo.success, false);

  // Evolution fails at Level 50 if Quest Item hasn't been looted from quest monsters
  const lvl50NoQuestItem = { ...nextState, level: 50, zen: 5000, hasFirstProfQuestItem: false };
  const missingQuestEvo = evolveCharacterClass(lvl50NoQuestItem);
  assert.equal(missingQuestEvo.success, false);

  // Evolution succeeds at Level 50 with Quest Item and consumes the Quest Item
  const lvl50WithQuestItem = { ...lvl50NoQuestItem, hasFirstProfQuestItem: true };
  const evo = evolveCharacterClass(lvl50WithQuestItem);
  assert.equal(evo.success, true);
  assert.equal(evo.nextState.classTier, 2);
  assert.equal(evo.nextState.hasFirstProfQuestItem, false);
  assert.equal(evo.nextState.statPoints, lvl50WithQuestItem.statPoints + 40);

  // Grand Reset requires Level 300
  const earlyReset = performGrandReset({ ...evo.nextState, level: 299 });
  assert.equal(earlyReset.success, false);

  const validReset = performGrandReset({ ...evo.nextState, level: 300 });
  assert.equal(validReset.success, true);
  assert.equal(validReset.nextState.resets, 1);
  assert.equal(validReset.nextState.level, 1);
  assert.equal(validReset.nextState.statPoints, evo.nextState.statPoints + 150);
});

test('buyPotionsWithZen purchases HP and MP potion packs for Zen and rejects when Zen is insufficient', () => {
  const initial = { ...createInitialPlayerState('dark_knight'), zen: 1800 };
  const buyHp5 = buyPotionsWithZen(initial, 'hp', 5);
  assert.equal(buyHp5.success, true);
  assert.equal(buyHp5.nextState.hpPotions, initial.hpPotions + 5);
  assert.equal(buyHp5.nextState.zen, initial.zen - 250);

  const buyMp20 = buyPotionsWithZen(buyHp5.nextState, 'mp', 20);
  assert.equal(buyMp20.success, true);
  assert.equal(buyMp20.nextState.mpPotions, initial.mpPotions + 20);

  const brokeState = { ...buyMp20.nextState, zen: 10 };
  const failedBuy = buyPotionsWithZen(brokeState, 'hp', 5);
  assert.equal(failedBuy.success, false);
});

test('upgradeItemWithJewel supports Bless, Soul, and Jewel of Life (+4 option)', () => {
  const initial = { ...createInitialPlayerState('dark_knight'), zen: 1500 };
  const boughtWeapon = buyStarterEquipmentWithZen(initial, 'weapon');
  assert.equal(boughtWeapon.success, true);
  const stateWithWeapon = boughtWeapon.nextState;

  const weaponId = stateWithWeapon.equipped.weapon!.id;
  const beforeLevel = stateWithWeapon.equipped.weapon!.level;
  const beforeLife = stateWithWeapon.equipped.weapon!.lifeOption;

  const blessRes = upgradeItemWithJewel(stateWithWeapon, weaponId, 'bless', 0.1);
  assert.equal(blessRes.success, true);
  assert.equal(blessRes.nextState.equipped.weapon!.level, beforeLevel + 1);

  const lifeRes = upgradeItemWithJewel(blessRes.nextState, weaponId, 'life');
  assert.equal(lifeRes.success, true);
  assert.equal(lifeRes.nextState.equipped.weapon!.lifeOption, beforeLife + 4);
});

test('craftChaosWings upgrades from Tier 2 Wings to Tier 3 Ancient Wings on second synthesis', () => {
  const initialBase = createInitialPlayerState('dark_wizard');
  // Players start with 0 Jewel of Chaos at Level 1 (Chaos drops only in 150+ territories)
  assert.equal(initialBase.jewels.chaos, 0);
  const initial = {
    ...initialBase,
    zen: 2000,
    jewels: { ...initialBase.jewels, chaos: 1 },
  };
  assert.equal(initial.equipped.wings, null);

  const firstCraft = craftChaosWings(initial);
  assert.equal(firstCraft.success, true);
  assert.equal(firstCraft.nextState.equipped.wings?.rarity, 'excellent');

  const withExtraChaos = {
    ...firstCraft.nextState,
    zen: 2000,
    jewels: { ...firstCraft.nextState.jewels, chaos: 1 },
  };
  const secondCraft = craftChaosWings(withExtraChaos);
  assert.equal(secondCraft.success, true);
  assert.equal(secondCraft.nextState.equipped.wings?.rarity, 'ancient');
});

test('unequipItemToInventory and equipItemFromInventory move items between paperdoll slots and inventory grid', () => {
  const initial = { ...createInitialPlayerState('dark_knight'), zen: 1500 };
  const withHelm = buyStarterEquipmentWithZen(initial, 'helm').nextState;
  const helmId = withHelm.equipped.helm!.id;
  const invCountBefore = withHelm.inventory.length;

  const unequipped = unequipItemToInventory(withHelm, 'helm');
  assert.equal(unequipped.success, true);
  assert.equal(unequipped.nextState.equipped.helm, null);
  assert.equal(unequipped.nextState.inventory.length, invCountBefore + 1);

  const helmInBag = unequipped.nextState.inventory.find((i) => i.id === helmId)!;
  assert.ok(helmInBag);

  const reequipped = equipItemFromInventory(unequipped.nextState, helmInBag);
  assert.equal(reequipped.success, true);
  assert.equal(reequipped.nextState.equipped.helm?.id, helmId);
  assert.equal(reequipped.nextState.inventory.length, invCountBefore);
});

test('TERRITORIES defines 24 iconic MU Online cities/regions with proportional equipment drop rarity from weak Common in early cities to Ancient in late cities', async () => {
  const { TERRITORIES, generateEquipmentDrop } = await import('./rules');
  assert.equal(TERRITORIES.length, 24);
  assert.equal(TERRITORIES[0].recommendedLevel, 1);
  assert.equal(TERRITORIES[23].recommendedLevel, 295);

  // Regular monsters in first cities (idx 0..2: Lorencia, Noria, Elbeland) ALWAYS drop weak Common ('normal') items
  const city1Drop = generateEquipmentDrop('dark_knight', 0, false, 0.99);
  const city3Drop = generateEquipmentDrop('dark_knight', 2, false, 0.99);
  assert.equal(city1Drop.rarity, 'normal');
  assert.equal(city3Drop.rarity, 'normal');
  assert.equal(city1Drop.lifeOption, 0);
  assert.equal(city1Drop.setName, undefined);

  // Golden Bosses ALWAYS drop rare items (magic / excellent / ancient), even in early cities!
  const earlyGoldenBossDrop = generateEquipmentDrop('dark_knight', 0, true, 0.25);
  assert.notEqual(earlyGoldenBossDrop.rarity, 'normal');
  assert.ok(
    earlyGoldenBossDrop.rarity === 'magic' ||
      earlyGoldenBossDrop.rarity === 'excellent' ||
      earlyGoldenBossDrop.rarity === 'ancient'
  );

  // Mid-game cities drop Magic / Excellent items from regular mobs with proportionally stronger stats
  const midCityDrop = generateEquipmentDrop('dark_knight', 10, false, 0.95);
  assert.equal(midCityDrop.rarity, 'excellent');
  assert.ok(
    midCityDrop.baseAttack + midCityDrop.baseDefense >
      city1Drop.baseAttack + city1Drop.baseDefense
  );

  // Late-game cities drop Ancient items with highest stats
  const lateGameDrop = generateEquipmentDrop('dark_knight', 23, true, 0.95);
  assert.equal(lateGameDrop.rarity, 'ancient');
  assert.ok(
    lateGameDrop.baseAttack + lateGameDrop.baseDefense >
      midCityDrop.baseAttack + midCityDrop.baseDefense
  );
});

test('buyShopEquipmentToInventory and buySkillBookWithZen require proximity to City Shop (isNearShop) and place items in inventory', async () => {
  const { buyShopEquipmentToInventory, getShopEquipmentCatalog } = await import('./rules');
  const dk = createInitialPlayerState('dark_knight');
  const catalog = getShopEquipmentCatalog('dark_knight');
  assert.ok(catalog.length >= 6);

  // Cannot buy equipment or skill books when far from the shop (isNearShop = false)
  const farEquip = buyShopEquipmentToInventory(dk, 'starter_weapon', false);
  assert.equal(farEquip.success, false);
  assert.equal(farEquip.nextState.inventory.length, 0);

  const farSkill = buySkillBookWithZen({ ...dk, level: 5, zen: 1000 }, 'cyclone_slash', false);
  assert.equal(farSkill.success, false);

  // When near shop (isNearShop = true), dragging equipment into inventory places it in inventory[]
  const nearEquip = buyShopEquipmentToInventory(dk, 'starter_weapon', true);
  assert.equal(nearEquip.success, true);
  assert.equal(nearEquip.nextState.inventory.length, 1);
  assert.equal(nearEquip.nextState.inventory[0].slot, 'weapon');
  assert.equal(nearEquip.nextState.equipped.weapon, null);
  assert.equal(nearEquip.nextState.zen, dk.zen - 250);
});

test('Bosses drop Jewel of Chaos with 20% chance in ANY territory while regular monsters drop Chaos only in 150+ territories', async () => {
  const {
    TERRITORIES,
    canTerritoryDropChaos,
    rollJewelDropType,
    calculateTerritoryMonsterDefense,
    performGrandReset,
  } = await import('./rules');

  for (const t of TERRITORIES) {
    // Bosses in ANY territory have a 20% chance (roll < 0.20) to drop Jewel of Chaos
    assert.equal(rollJewelDropType(t.recommendedLevel, true, 0.15), 'jewel_chaos');
    assert.notEqual(rollJewelDropType(t.recommendedLevel, true, 0.25), 'jewel_chaos');

    // Regular monsters drop Jewel of Chaos ONLY in 150+ territories
    if (t.recommendedLevel < 150) {
      assert.equal(canTerritoryDropChaos(t.recommendedLevel), false);
      assert.notEqual(rollJewelDropType(t.recommendedLevel, false, 0.001), 'jewel_chaos');
    } else {
      assert.equal(canTerritoryDropChaos(t.recommendedLevel), true);
      assert.equal(rollJewelDropType(t.recommendedLevel, false, 0.01), 'jewel_chaos');
    }
  }

  // Verify monster multipliers and defense escalate steeply with every territory
  for (let i = 1; i < TERRITORIES.length; i++) {
    const prev = TERRITORIES[i - 1];
    const curr = TERRITORIES[i];
    assert.ok(
      curr.enemyLevelMultiplier > prev.enemyLevelMultiplier * 1.25,
      `Territory ${curr.name} multiplier (${curr.enemyLevelMultiplier}) should be noticeably stronger than ${prev.name} (${prev.enemyLevelMultiplier})`
    );
    assert.ok(
      calculateTerritoryMonsterDefense(curr.enemyLevelMultiplier) >
        calculateTerritoryMonsterDefense(prev.enemyLevelMultiplier)
    );
  }

  // Verify Grand Reset provides strong multiplicative combat power motivation (+45% attack/defense + 150 stat points per Reset)
  const lvl300Hero = {
    ...createInitialPlayerState('dark_knight'),
    level: 300,
    attributes: { str: 400, agi: 250, vit: 200, ene: 100 },
  };
  const beforeResetStats = calculateDerivedStats(lvl300Hero);
  const afterReset = performGrandReset(lvl300Hero);
  assert.equal(afterReset.success, true);
  const afterResetStats = calculateDerivedStats(afterReset.nextState);
  assert.ok(afterResetStats.maxDamage > beforeResetStats.maxDamage * 1.4);
  assert.ok(afterResetStats.defense > beforeResetStats.defense * 1.4);
});

test('Blood Castle Ticket crafting uses 1 Blood Scroll + 1 Blood Fang + 1 Jewel of Chaos with 80% success rate, and quest completion awards +3 Jewel of Chaos and EXP', async () => {
  const {
    craftBloodCastleTicket,
    enterBloodCastle,
    completeBloodCastleQuest,
  } = await import('./rules');

  const base = createInitialPlayerState('dark_knight');

  // Cannot craft without Scroll, Fang, and Chaos
  const missingMats = craftBloodCastleTicket(base, 0.1);
  assert.equal(missingMats.success, false);

  const readyToCraft = {
    ...base,
    bloodScrolls: 2,
    bloodFangs: 2,
    jewels: { ...base.jewels, chaos: 2 },
  };

  // 80% success chance: roll = 0.79 succeeds and produces 1 ticket
  const successCraft = craftBloodCastleTicket(readyToCraft, 0.79);
  assert.equal(successCraft.success, true);
  assert.equal(successCraft.crafted, true);
  assert.equal(successCraft.nextState.bloodCastleTickets, 1);
  assert.equal(successCraft.nextState.bloodScrolls, 1);
  assert.equal(successCraft.nextState.bloodFangs, 1);
  assert.equal(successCraft.nextState.jewels.chaos, 1);

  // 20% failure chance: roll = 0.85 burns the 3 ingredients without granting a ticket
  const failCraft = craftBloodCastleTicket(successCraft.nextState, 0.85);
  assert.equal(failCraft.crafted, false);
  assert.equal(failCraft.nextState.bloodCastleTickets, 1);
  assert.equal(failCraft.nextState.bloodScrolls, 0);
  assert.equal(failCraft.nextState.bloodFangs, 0);
  assert.equal(failCraft.nextState.jewels.chaos, 0);

  // Entering Blood Castle consumes 1 ticket and sets inBloodCastle = true
  const entered = enterBloodCastle(failCraft.nextState);
  assert.equal(entered.success, true);
  assert.equal(entered.nextState.inBloodCastle, true);
  assert.equal(entered.nextState.bloodCastleTickets, 0);

  // Completing the 4-stage Blood Castle quest awards +3 Jewel of Chaos, massive EXP (levels up), and Zen
  const completed = completeBloodCastleQuest(entered.nextState);
  assert.equal(completed.nextState.jewels.chaos, entered.nextState.jewels.chaos + 3);
  assert.ok(completed.nextState.level > entered.nextState.level);
  assert.equal(completed.nextState.bloodCastleClears, 1);
});

test('Stylized territory map layouts include winding trails, fences, rivers with bridges, and 1 VIP spot spawning +2 extra ranged mobs', async () => {
  const {
    getTerritoryMapLayout,
    getCampSpawnSpecs,
    TERRITORIES,
  } = await import('./rules');

  const lorencia = getTerritoryMapLayout('lorencia');
  assert.equal(lorencia.territoryId, 'lorencia');
  assert.ok(lorencia.trails.length >= 6, 'Lorencia should have winding dirt trails connecting all spots');
  assert.ok(lorencia.rivers.length >= 2, 'Lorencia should have rivers/streams flowing across the map');
  assert.ok(
    lorencia.rivers.every((r) => r.bridges.length >= 1),
    'Every river in Lorencia should have wooden bridges'
  );
  assert.ok(lorencia.fences.length >= 10, 'Lorencia should have wooden pasture and road fences');
  assert.ok(lorencia.props.length >= 20, 'Lorencia should have trees, road signs, carts, and campfires');
  assert.equal(lorencia.camps.length, 8);

  const lorenciaVipCamps = lorencia.camps.filter((c) => c.isVip);
  assert.equal(lorenciaVipCamps.length, 1, 'Lorencia must have exactly 1 VIP hunting spot');

  const vipSpecs = getCampSpawnSpecs(lorenciaVipCamps[0]);
  assert.equal(vipSpecs.totalCount, 10, 'VIP spot spawns 10 monsters (8 base + 2 extra ranged)');
  assert.equal(
    vipSpecs.forceRangedFlags.filter(Boolean).length,
    2,
    'VIP spot guarantees +2 extra ranged monsters'
  );

  const regularCamp = lorencia.camps.find((c) => !c.isVip)!;
  const regularSpecs = getCampSpawnSpecs(regularCamp);
  assert.equal(regularSpecs.totalCount, 8, 'Regular spot spawns 8 monsters');
  assert.equal(regularSpecs.forceRangedFlags.filter(Boolean).length, 0);

  // Verify other cities have distinct layouts and rotated VIP spots
  const noria = getTerritoryMapLayout('noria');
  const devias = getTerritoryMapLayout('devias');
  assert.notDeepEqual(lorencia.rivers[0].points, noria.rivers[0].points);
  assert.notEqual(
    lorencia.camps.findIndex((c) => c.isVip),
    noria.camps.findIndex((c) => c.isVip)
  );
  assert.notEqual(
    noria.camps.findIndex((c) => c.isVip),
    devias.camps.findIndex((c) => c.isVip)
  );

  for (const t of TERRITORIES) {
    const layout = getTerritoryMapLayout(t.id);
    assert.equal(layout.camps.filter((c) => c.isVip).length, 1);
  }
});

test('Online Co-op Party logic sanitizes room codes and nicknames, filters same-zone allies, and grants +20% EXP bonus per party ally', async () => {
  const {
    sanitizePartyCode,
    sanitizePlayerNickname,
    sanitizePartyChatText,
    calculatePartyCoopExpBonus,
    getSameZonePartyAllies,
  } = await import('./party');

  assert.equal(sanitizePartyCode('  bro-777!@# '), 'BRO-777');
  assert.equal(sanitizePartyCode(''), 'MU-1');
  assert.equal(sanitizePlayerNickname('<script>DarkLord</script>'), 'scriptDarkLord/scr');
  assert.equal(sanitizePartyChatText('  Го на ВИП спот! \n'), 'Го на ВИП спот!');

  // Solo hunting: 0% bonus, 0 shared ally exp
  const solo = calculatePartyCoopExpBonus(100, 0);
  assert.equal(solo.bonusPct, 0);
  assert.equal(solo.killerTotalExp, 100);
  assert.equal(solo.sharedAllyExp, 0);

  // Hunting with 1 friend in the same territory: +20% killer EXP bonus and 70 shared EXP for friend
  const duo = calculatePartyCoopExpBonus(100, 1);
  assert.equal(duo.bonusPct, 20);
  assert.equal(duo.killerTotalExp, 120);
  assert.equal(duo.sharedAllyExp, 70);

  // Full 5-player party (4 allies in same zone): +80% EXP bonus
  const fullParty = calculatePartyCoopExpBonus(100, 4);
  assert.equal(fullParty.bonusPct, 80);
  assert.equal(fullParty.killerTotalExp, 180);

  const mockMembers = [
    {
      id: 'hero_1',
      nickname: 'Hero1',
      roomCode: 'MU-1',
      classId: 'dark_knight' as const,
      classTier: 1 as const,
      level: 10,
      resets: 0,
      hp: 400,
      maxHp: 400,
      mp: 150,
      maxMp: 150,
      territoryId: 'lorencia' as const,
      inBloodCastle: false,
      x: 0,
      y: 0,
      facingAngle: 0,
      walkDistance: 0,
      hasWeapon: true,
      hasWings: false,
      activeSkillPattern: null,
      activeSkillColor: '#fbbf24',
      activeSkillTimestamp: 0,
      lastUpdatedAt: Date.now(),
    },
    {
      id: 'hero_2',
      nickname: 'FriendInLorencia',
      roomCode: 'MU-1',
      classId: 'fairy_elf' as const,
      classTier: 1 as const,
      level: 12,
      resets: 0,
      hp: 380,
      maxHp: 380,
      mp: 200,
      maxMp: 200,
      territoryId: 'lorencia' as const,
      inBloodCastle: false,
      x: 120,
      y: -150,
      facingAngle: 0,
      walkDistance: 0,
      hasWeapon: true,
      hasWings: false,
      activeSkillPattern: null,
      activeSkillColor: '#34d399',
      activeSkillTimestamp: 0,
      lastUpdatedAt: Date.now(),
    },
    {
      id: 'hero_3',
      nickname: 'FriendInNoria',
      roomCode: 'MU-1',
      classId: 'dark_wizard' as const,
      classTier: 1 as const,
      level: 25,
      resets: 0,
      hp: 320,
      maxHp: 320,
      mp: 450,
      maxMp: 450,
      territoryId: 'noria' as const,
      inBloodCastle: false,
      x: 0,
      y: 0,
      facingAngle: 0,
      walkDistance: 0,
      hasWeapon: true,
      hasWings: false,
      activeSkillPattern: null,
      activeSkillColor: '#38bdf8',
      activeSkillTimestamp: 0,
      lastUpdatedAt: Date.now(),
    },
  ];

  const alliesInLorencia = getSameZonePartyAllies(mockMembers, 'hero_1', 'lorencia', false);
  assert.equal(alliesInLorencia.length, 1);
  assert.equal(alliesInLorencia[0].nickname, 'FriendInLorencia');

  const { electZoneHostId, sanitizeSharedMonsterList } = await import('./party');
  // Both hero_1 and hero_2 in Lorencia deterministically elect hero_1 as Zone Host
  const hostFromHero1 = electZoneHostId(mockMembers, 'hero_1', 'lorencia', false);
  const hostFromHero2 = electZoneHostId(mockMembers, 'hero_2', 'lorencia', false);
  assert.equal(hostFromHero1, 'hero_1');
  assert.equal(hostFromHero2, 'hero_1');

  // hero_3 alone in Noria elects hero_3 as Zone Host for Noria
  const hostInNoria = electZoneHostId(mockMembers, 'hero_3', 'noria', false);
  assert.equal(hostInNoria, 'hero_3');

  const sanitizedMobs = sanitizeSharedMonsterList([
    {
      id: 'm_0_1',
      name: '👑 ВИП Лич-Стрелок Лоренсии (Дальний)',
      archetype: 'kiter_lich',
      isBoss: false,
      isQuestMonster: true,
      x: 1380,
      y: -1380,
      campX: 1350,
      campY: -1350,
      radius: 23,
      hp: 150,
      maxHp: 175,
      attackDamage: 39,
      moveSpeed: 108,
      attackRange: 235,
      expReward: 88,
      zenReward: 150,
      color: '#fde047',
      aiState: 'move',
      telegraphX: 1380,
      telegraphY: -1380,
      facingAngle: 1.2,
      walkDistance: 45,
      chillTimer: 0,
      orbitDirection: -1,
    },
  ]);
  assert.equal(sanitizedMobs.length, 1);
  assert.equal(sanitizedMobs[0].id, 'm_0_1');
  assert.equal(sanitizedMobs[0].archetype, 'kiter_lich');
  assert.equal(sanitizedMobs[0].hp, 150);
  assert.equal(sanitizedMobs[0].maxHp, 175);
  assert.equal(sanitizedMobs[0].x, 1380);
  assert.equal(sanitizedMobs[0].orbitDirection, -1);
});

test('applyCompletedTradeToPlayer transfers Zen, Jewels, and inventory items between trading players', async () => {
  const { applyCompletedTradeToPlayer } = await import('./party');
  const { generateEquipmentDrop } = await import('./rules');
  const sword = generateEquipmentDrop('dark_knight', 2, false, 0.2);
  const bow = generateEquipmentDrop('fairy_elf', 3, true, 0.5);

  const playerA = {
    ...createInitialPlayerState('dark_knight'),
    zen: 1000,
    jewels: { bless: 3, soul: 2, life: 1, chaos: 1 },
    inventory: [sword],
  };

  const completedSession = {
    tradeId: 'trd_test_1',
    initiatorId: 'hero_a',
    initiatorNickname: 'KnightA',
    targetId: 'hero_b',
    targetNickname: 'ElfB',
    territoryId: 'lorencia' as const,
    inBloodCastle: false,
    status: 'completed' as const,
    offers: {
      hero_a: {
        zen: 400,
        items: [sword],
        jewels: { bless: 2, soul: 0, life: 0, chaos: 1 },
        locked: true,
      },
      hero_b: {
        zen: 150,
        items: [bow],
        jewels: { bless: 0, soul: 3, life: 1, chaos: 0 },
        locked: true,
      },
    },
  };

  const afterA = applyCompletedTradeToPlayer(playerA, 'hero_a', completedSession);
  assert.equal(afterA.zen, 750);
  assert.deepEqual(afterA.jewels, { bless: 1, soul: 5, life: 2, chaos: 0 });
  assert.equal(afterA.inventory.length, 1);
  assert.equal(afterA.inventory[0].name, bow.name);
});

test('Server-authoritative monster HP, slightly spread-out spawn points, and per-unit individual Server Game Time respawns work independently', async () => {
  const {
    buildTerritoryUnitBlueprints,
    createInitialZoneMonsterMap,
    applyServerMonsterDamage,
    reviveDueServerMonsters,
    WORLD_TOWN_SAFE_RADIUS,
  } = await import('./worldMonsters');
  const {
    syncServerClockOffset,
    getServerSyncedNowMs,
    getWorldGameTimeSec,
  } = await import('./party');

  // 1. Server clock offset aligns client game time strictly to Server UTC time
  const fakeClientNow = 1_800_000_000_000;
  const fakeServerNow = fakeClientNow + 12_500; // Server is 12.5s ahead of client
  syncServerClockOffset(fakeServerNow, fakeClientNow);
  assert.equal(getServerSyncedNowMs(fakeClientNow), fakeServerNow);
  assert.equal(
    getWorldGameTimeSec(getServerSyncedNowMs(fakeClientNow)),
    getWorldGameTimeSec(fakeServerNow)
  );
  // Reset offset back to 0 so subsequent tests use normal clock
  syncServerClockOffset(Date.now(), Date.now());

  // 2. Deterministic roster has 66 unique slots (8 camps * 8 + 2 VIP ranged),
  //    distinct per-unit respawn durations, and spread-out anchors outside Town Safe Zone
  const blueprints = buildTerritoryUnitBlueprints('lorencia');
  assert.equal(blueprints.length, 66);
  const uniqueIds = new Set(blueprints.map((u) => u.id));
  assert.equal(uniqueIds.size, 66);

  const uniqueRespawnDurations = new Set(blueprints.map((u) => u.respawnDurationSec));
  assert.ok(
    uniqueRespawnDurations.size >= 5,
    'Individual units should have varied personal respawn timers rather than one uniform timer'
  );

  for (const unit of blueprints) {
    assert.ok(
      Math.hypot(unit.anchorX, unit.anchorY) >= WORLD_TOWN_SAFE_RADIUS + 260,
      `Unit ${unit.id} must spawn safely outside City Safe Zone`
    );
  }

  // Verify spawn points around camp 0 are slightly spread out (average distance from camp center >= 170px)
  const camp0Units = blueprints.filter((u) => u.campIdx === 0);
  const avgDistFromCamp =
    camp0Units.reduce((acc, u) => acc + Math.hypot(u.anchorX - u.campX, u.anchorY - u.campY), 0) /
    camp0Units.length;
  assert.ok(
    avgDistFromCamp >= 170 && avgDistFromCamp <= 430,
    `Expected slightly spread-out spawn radius (170..430px), got ${Math.round(avgDistFromCamp)}`
  );

  // 3. Server-authoritative shared HP deduction between two players hitting the exact same monster
  const t0 = 50000;
  const zoneMap = createInitialZoneMonsterMap('lorencia', t0);
  const unitA = zoneMap.get(blueprints[0].id)!;
  const unitB = zoneMap.get(blueprints[1].id)!;
  const initialHpA = unitA.maxHp;

  // Player 1 hits unitA for 60 damage
  const hit1 = applyServerMonsterDamage(zoneMap, unitA.id, 60, t0);
  assert.equal(hit1.found, true);
  assert.equal(hit1.killed, false);
  assert.equal(unitA.hp, initialHpA - 60);

  // Player 2 hits the exact same unitA for the remaining HP -> Server confirms kill & stamps unitA's personal respawnAtGameTimeSec
  const hit2 = applyServerMonsterDamage(zoneMap, unitA.id, unitA.hp + 50, t0 + 1);
  assert.equal(hit2.killed, true);
  assert.equal(unitA.alive, false);
  assert.equal(unitA.hp, 0);
  assert.equal(hit2.respawnAtGameTimeSec, t0 + 1 + unitA.respawnDurationSec);

  // Kill unitB 5 seconds later
  const hitB = applyServerMonsterDamage(zoneMap, unitB.id, unitB.maxHp + 20, t0 + 6);
  assert.equal(hitB.killed, true);
  assert.equal(unitB.alive, false);

  // Advance continuous server time to right after unitA's personal respawn (before unitB's if unitB is later)
  const checkTimeA = Math.max(hit2.respawnAtGameTimeSec, hitB.respawnAtGameTimeSec) - 0.5;
  const earlierUnit = hit2.respawnAtGameTimeSec <= hitB.respawnAtGameTimeSec ? unitA : unitB;
  const laterUnit = earlierUnit === unitA ? unitB : unitA;

  if (hit2.respawnAtGameTimeSec !== hitB.respawnAtGameTimeSec) {
    const revivedMid = reviveDueServerMonsters(zoneMap, checkTimeA);
    assert.equal(revivedMid.length, 1);
    assert.equal(revivedMid[0].id, earlierUnit.id);
    assert.equal(earlierUnit.alive, true);
    assert.equal(earlierUnit.hp, earlierUnit.maxHp);
    assert.equal(laterUnit.alive, false, 'Later unit must remain dead until its own server respawn time');
  }

  // Advance past both respawn times -> later unit also revives individually
  const revivedEnd = reviveDueServerMonsters(
    zoneMap,
    Math.max(hit2.respawnAtGameTimeSec, hitB.respawnAtGameTimeSec) + 1
  );
  assert.equal(earlierUnit.alive, true);
  assert.equal(laterUnit.alive, true);
  assert.ok(revivedEnd.length >= 1 || hit2.respawnAtGameTimeSec === hitB.respawnAtGameTimeSec);
});

test('Dedicated Blood Castle bridge monsters use 5-second respawn timers and Blood Castle enforces a 3-minute time limit', async () => {
  const {
    BLOOD_CASTLE_RESPAWN_DURATION_SEC,
    BLOOD_CASTLE_TIME_LIMIT_SEC,
    BLOOD_CASTLE_UNIT_COUNT,
    BLOOD_CASTLE_BRIDGE_HALF_WIDTH,
    BLOOD_CASTLE_GATE_Y,
    BLOOD_CASTLE_HERO_START_Y,
    buildBloodCastleBridgeUnits,
    pickBloodCastleBridgeRespawnPoint,
    formatCountdownMMSS,
    advanceBloodCastleTimer,
  } = await import('./worldMonsters');

  assert.equal(BLOOD_CASTLE_RESPAWN_DURATION_SEC, 5);
  assert.equal(BLOOD_CASTLE_TIME_LIMIT_SEC, 180);

  const bcUnits = buildBloodCastleBridgeUnits('lorencia', 30);
  assert.equal(bcUnits.length, BLOOD_CASTLE_UNIT_COUNT);

  const ids = new Set<string>();
  for (const unit of bcUnits) {
    ids.add(unit.id);
    assert.ok(unit.id.startsWith('bc_unit_'), `Expected dedicated bc_unit_ id, got ${unit.id}`);
    assert.equal(unit.respawnDurationSec, 5, 'Every Blood Castle bridge unit must have 5s respawn');
    assert.equal(unit.isBoss, false);
    assert.equal(unit.isStructure, false);
    assert.ok(
      Math.abs(unit.anchorX) <= BLOOD_CASTLE_BRIDGE_HALF_WIDTH - 40,
      'Blood Castle anchor X must stay within the bridge'
    );
    assert.ok(
      unit.anchorY > BLOOD_CASTLE_GATE_Y && unit.anchorY < BLOOD_CASTLE_HERO_START_Y,
      'Blood Castle anchor Y must stay between Castle Gates and Hero Start'
    );

    const respawnPt = pickBloodCastleBridgeRespawnPoint(unit.anchorX, unit.anchorY, 0.3, 0.8);
    assert.ok(Math.abs(respawnPt.x) <= BLOOD_CASTLE_BRIDGE_HALF_WIDTH - 44);
    assert.ok(respawnPt.y >= BLOOD_CASTLE_GATE_Y + 95 && respawnPt.y <= BLOOD_CASTLE_HERO_START_Y - 220);
  }
  assert.equal(ids.size, BLOOD_CASTLE_UNIT_COUNT);

  // Countdown formatting
  assert.equal(formatCountdownMMSS(180), '03:00');
  assert.equal(formatCountdownMMSS(65), '01:05');
  assert.equal(formatCountdownMMSS(9.2), '00:10');
  assert.equal(formatCountdownMMSS(0), '00:00');

  // 3-minute Blood Castle timer warnings and timeout
  const step1Min = advanceBloodCastleTimer(60.5, 1.0, false);
  assert.equal(step1Min.crossedOneMinuteMark, true);
  assert.equal(step1Min.timedOut, false);

  const step30Sec = advanceBloodCastleTimer(30.2, 0.5, false);
  assert.equal(step30Sec.crossedThirtySecMark, true);
  assert.equal(step30Sec.timedOut, false);

  const stepTimeout = advanceBloodCastleTimer(0.4, 0.5, false);
  assert.equal(stepTimeout.nextRemainingSec, 0);
  assert.equal(stepTimeout.timedOut, true);

  // Completed Blood Castle freezes timer and never times out
  const stepCompleted = advanceBloodCastleTimer(10, 20, true);
  assert.equal(stepCompleted.nextRemainingSec, 10);
  assert.equal(stepCompleted.timedOut, false);
});

test('Centralized /src/config exposes server, respawn, drop rate, and character scaling constants consistently', async () => {
  const {
    SERVER_CONFIG,
    MONSTER_RESPAWN_CONFIG,
    BLOOD_CASTLE_CONFIG,
    DROP_RATES,
    CHARACTER_SCALING,
    getPublicServerConfigSnapshot,
  } = await import('../config');

  assert.equal(SERVER_CONFIG.maxPartySize, 5);
  assert.equal(SERVER_CONFIG.groundLootTtlMs, 60_000);
  assert.equal(SERVER_CONFIG.rates.expMultiplier, 0.5);
  assert.equal(SERVER_CONFIG.rates.zenMultiplier, 0.5);
  assert.equal(MONSTER_RESPAWN_CONFIG.byArchetype.territory_boss.baseSec, 900);
  assert.equal(BLOOD_CASTLE_CONFIG.respawnDurationSec, 5);
  assert.equal(BLOOD_CASTLE_CONFIG.timeLimitSec, 180);
  assert.equal(DROP_RATES.jewels.minTerritoryLevelForRegularChaos, 150);
  assert.equal(DROP_RATES.chaosMachine.bloodCastleTicketSuccessRate, 0.8);
  assert.equal(CHARACTER_SCALING.grandReset.requiredLevel, 300);
  assert.equal(CHARACTER_SCALING.professions.first.requiredLevel, 50);

  const snapshot = getPublicServerConfigSnapshot();
  assert.equal(snapshot.bloodCastle.bridgeUnitCount, 36);
  assert.equal(snapshot.dropRates.equipment.regularMonsterChance, 0.07);
  assert.equal(snapshot.characterScaling.statPointsPerLevelByTier.tier3, 7);
});

test('SQLite GameDatabase persists characters, equipped & inventory items, owner tokens, world monsters, and trade logs', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { GameDatabase } = await import('../../server/db');
  const { generateEquipmentDrop } = await import('./rules');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mu-db-test-'));
  const dbPath = path.join(tmpDir, 'test.sqlite');
  const db = new GameDatabase(dbPath);

  try {
    const baseState = createInitialPlayerState('dark_wizard');
    const staff = generateEquipmentDrop('dark_wizard', 8, true, 0.9);
    const helm = generateEquipmentDrop('dark_wizard', 5, false, 0.7);
    const savedState = {
      ...baseState,
      level: 42,
      resets: 1,
      zen: 25_400,
      jewels: { bless: 5, soul: 4, life: 3, chaos: 2 },
      learnedSkills: ['dw_evil_spirits', 'dw_meteor'],
      equipped: { ...baseState.equipped, weapon: { ...staff, slot: 'weapon' as const } },
      inventory: [helm],
      totalKills: 312,
      bossesDefeated: 4,
      bloodCastleClears: 2,
    };

    const { record, ownerToken } = db.createCharacter({
      nickname: 'АрхимагТест',
      player: savedState,
    });
    assert.ok(record.id.startsWith('char_'));
    assert.ok(ownerToken.length >= 32);

    // Owner token loads full state including equipped & inventory items from character_items table
    const loaded = db.getCharacterForOwner(record.id, ownerToken);
    assert.equal(loaded.status, 'ok');
    if (loaded.status === 'ok') {
      assert.equal(loaded.record.nickname, 'АрхимагТест');
      assert.equal(loaded.record.player.level, 42);
      assert.equal(loaded.record.player.resets, 1);
      assert.equal(loaded.record.player.zen, 25_400);
      assert.equal(loaded.record.player.jewels.chaos, 2);
      assert.deepEqual(loaded.record.player.learnedSkills, ['dw_evil_spirits', 'dw_meteor']);
      assert.equal(loaded.record.player.equipped.weapon?.id, staff.id);
      assert.equal(loaded.record.player.inventory.length, 1);
      assert.equal(loaded.record.player.inventory[0].id, helm.id);
    }

    // Wrong token must be rejected for read and update
    const forbiddenRead = db.getCharacterForOwner(record.id, 'wrong_token_value');
    assert.equal(forbiddenRead.status, 'forbidden');

    const forbiddenUpdate = db.updateCharacterForOwner({
      characterId: record.id,
      ownerToken: 'wrong_token_value',
      player: { ...savedState, level: 399 },
    });
    assert.equal(forbiddenUpdate.status, 'forbidden');

    // Valid token updates character & replaces items atomically
    const updated = db.updateCharacterForOwner({
      characterId: record.id,
      ownerToken,
      nickname: 'ГрандМастер',
      player: { ...savedState, level: 55, zen: 99_000, inventory: [] },
    });
    assert.equal(updated.status, 'ok');

    const summaries = db.listCharacterSummaries(10);
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].nickname, 'ГрандМастер');
    assert.equal(summaries[0].level, 55);
    assert.equal(summaries[0].equippedCount, 1);
    assert.equal(summaries[0].inventoryCount, 0);

    // World monster state persists across reload
    db.saveZoneMonsterState(
      'MU-1',
      'lorencia',
      {
        deadRespawns: { lorencia_c0_u0: 5000.5 },
        damagedHp: { lorencia_c0_u1: 88 },
      },
      4990
    );
    const loadedWorld = db.loadAllWorldMonsterStates(4995);
    const zoneData = loadedWorld.get('MU-1::lorencia');
    assert.ok(zoneData);
    assert.equal(zoneData?.deadRespawns.lorencia_c0_u0, 5000.5);
    assert.equal(zoneData?.damagedHp.lorencia_c0_u1, 88);

    // Completed trade audit log persists
    db.logCompletedTrade('MU-1', {
      tradeId: 'trd_db_1',
      initiatorId: 'p1',
      initiatorNickname: 'ГрандМастер',
      targetId: 'p2',
      targetNickname: 'ЭльфДруг',
      territoryId: 'lorencia',
      inBloodCastle: false,
      status: 'completed',
      offers: {
        p1: { zen: 500, items: [helm], jewels: { bless: 1, soul: 0, life: 0, chaos: 0 }, locked: true },
        p2: { zen: 0, items: [], jewels: { bless: 0, soul: 0, life: 0, chaos: 1 }, locked: true },
      },
    });
    const trades = db.listRecentTrades(5);
    assert.equal(trades.length, 1);
    assert.equal(trades[0].tradeId, 'trd_db_1');

    const stats = db.getStats();
    assert.equal(stats.charactersCount, 1);
    assert.equal(stats.itemsCount, 1);
    assert.equal(stats.persistedMonstersCount, 2);
    assert.equal(stats.tradesCount, 1);
  } finally {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Equipped wings switch hero from ground running to levitating flight kinematics, and players can drop inventory/equipped items onto the ground with 60s TTL', async () => {
  const { getHeroFlightKinematics } = await import('./models');
  const {
    GROUND_LOOT_TTL_MS,
    createEquipmentGroundDrop,
    getGroundLootRemainingSec,
    isGroundLootExpired,
  } = await import('./party');
  const {
    CLASSES,
    dropEquippedItemToGround,
    dropItemFromInventory,
    generateEquipmentDrop,
  } = await import('./rules');

  // 1. Winged flight kinematics: elevated hover, zero running leg stride, forward aerodynamic lean, softened shadow
  const flyingMoving = getHeroFlightKinematics({
    hasWings: true,
    isMoving: true,
    walkDistance: 240,
    now: 1200,
    facingAngle: 0,
  });
  assert.equal(flyingMoving.isFlying, true);
  assert.equal(flyingMoving.legsRunning, false);
  assert.equal(flyingMoving.stride, 0);
  assert.ok(flyingMoving.bodyBob <= -11, `Expected elevated hover bodyBob <= -11, got ${flyingMoving.bodyBob}`);
  assert.ok(flyingMoving.glideTiltRad > 0.08, 'Expected positive forward glide tilt when flying right');
  assert.ok(flyingMoving.shadowScale < 0.85, 'Expected smaller ground shadow while levitating');
  assert.ok(flyingMoving.shadowAlpha < 0.45, 'Expected softer ground shadow while levitating');

  // 2. Grounded hero without wings: legs run when moving, stand still when idle
  const groundMoving = getHeroFlightKinematics({
    hasWings: false,
    isMoving: true,
    walkDistance: 15,
    now: 1200,
    facingAngle: 0,
  });
  assert.equal(groundMoving.isFlying, false);
  assert.equal(groundMoving.legsRunning, true);
  assert.equal(groundMoving.glideTiltRad, 0);
  assert.equal(groundMoving.shadowScale, 1);

  const groundIdle = getHeroFlightKinematics({
    hasWings: false,
    isMoving: false,
    walkDistance: 500,
    now: 1200,
    facingAngle: 0,
  });
  assert.equal(groundIdle.isFlying, false);
  assert.equal(groundIdle.legsRunning, false);
  assert.equal(groundIdle.stride, 0, 'Idle grounded hero must not run legs even if walkDistance > 0');

  // 3. Dropping inventory & equipped items onto the ground
  const initial = createInitialPlayerState('dark_knight');
  const starterSword = CLASSES.dark_knight.startingWeapon;
  const extraDrop = generateEquipmentDrop('dark_knight', 6, true, 0.88);
  const stateWithGear = {
    ...initial,
    equipped: {
      ...initial.equipped,
      weapon: starterSword,
    },
    inventory: [extraDrop, ...initial.inventory],
  };

  const invDropRes = dropItemFromInventory(stateWithGear, extraDrop.id);
  assert.equal(invDropRes.success, true);
  assert.equal(invDropRes.droppedItem?.id, extraDrop.id);
  assert.equal(
    invDropRes.nextState.inventory.some((i) => i.id === extraDrop.id),
    false,
    'Dropped item must be removed from inventory'
  );

  // Dropping equipped weapon clears slot and returns the item
  const eqDropRes = dropEquippedItemToGround(invDropRes.nextState, 'weapon');
  assert.equal(eqDropRes.success, true);
  assert.equal(eqDropRes.droppedItem?.id, starterSword.id);
  assert.equal(eqDropRes.nextState.equipped.weapon, null);

  // Ground LootDrop creation with 60-second TTL and expiration checks
  const nowMs = 1_750_000_000_000;
  const groundDrop = createEquipmentGroundDrop(
    extraDrop,
    120,
    -80,
    'РыцарьСвета',
    nowMs,
    'abc12'
  );
  assert.equal(groundDrop.type, 'equipment');
  assert.equal(groundDrop.equipment?.id, extraDrop.id);
  assert.equal(groundDrop.droppedByNickname, 'РыцарьСвета');
  assert.equal(groundDrop.expiresAtMs, nowMs + GROUND_LOOT_TTL_MS);
  assert.equal(isGroundLootExpired(groundDrop, nowMs + 30_000), false);
  assert.equal(getGroundLootRemainingSec(groundDrop, nowMs + 30_000), 30);
  assert.equal(isGroundLootExpired(groundDrop, nowMs + GROUND_LOOT_TTL_MS + 10), true);
});

test('maxLevelsPerKill defaults to 1 level per kill and clamps overflow EXP, while 0/null unlocks multi-level jumps', async () => {
  const { CHARACTER_SCALING } = await import('../config/characterScaling');
  assert.equal(
    CHARACTER_SCALING.maxLevelsPerKill,
    1,
    'Default CHARACTER_SCALING.maxLevelsPerKill must be 1 level per monster kill'
  );

  const initial = createInitialPlayerState('dark_knight');
  assert.equal(initial.level, 1);

  // Huge EXP drop from a high-level monster: default cap restricts gain to +1 level and clamps EXP to expToNext - 1
  const capped = grantExperience(initial, 99_999);
  assert.equal(capped.leveledUp, true);
  assert.equal(capped.levelsGained, 1);
  assert.equal(capped.nextState.level, 2);
  assert.equal(
    capped.nextState.exp,
    capped.nextState.expToNext - 1,
    'Overflow EXP beyond 1-level cap must clamp to expToNext - 1 (99% of next level)'
  );
  assert.equal(capped.nextState.statPoints, initial.statPoints + 5);

  // Explicit override = 2 allows gaining at most 2 levels
  const cappedTwo = grantExperience(initial, 99_999, 2);
  assert.equal(cappedTwo.levelsGained, 2);
  assert.equal(cappedTwo.nextState.level, 3);
  assert.equal(cappedTwo.nextState.exp, cappedTwo.nextState.expToNext - 1);

  // Override = null or 0 disables the per-kill level cap and allows multi-level jumps
  const unlimitedNull = grantExperience(initial, 25_000, null);
  assert.ok(unlimitedNull.levelsGained > 3, 'null cap must allow multi-level jumps in one kill');
  assert.equal(unlimitedNull.nextState.level, 1 + unlimitedNull.levelsGained);

  const unlimitedZero = grantExperience(initial, 25_000, 0);
  assert.equal(unlimitedZero.nextState.level, unlimitedNull.nextState.level);
});

test('Level-gated territory travel, Grand Reset returning hero to Lorencia, and 15-minute roaming Golden Boss invasions outside monster camps', async () => {
  const { canEnterTerritory, performGrandReset, getTerritoryMapLayout, TERRITORIES } = await import(
    './rules'
  );
  const {
    GOLDEN_BOSS_INTERVAL_SEC,
    WORLD_TOWN_SAFE_RADIUS,
    createInitialZoneMonsterMap,
    createTerritoryBossUnit,
    pickGoldenBossRandomSpawnPoint,
    evaluateGoldenBoss15MinSpawn,
    applyServerMonsterDamage,
  } = await import('./worldMonsters');
  const { MONSTER_RESPAWN_CONFIG } = await import('../config/respawns');

  // 1. Territory travel strictly requires player.level >= territory.recommendedLevel
  assert.equal(canEnterTerritory(1, 'lorencia').allowed, true);
  assert.equal(canEnterTerritory(1, 'noria').allowed, false);
  assert.equal(canEnterTerritory(11, 'noria').allowed, false);
  assert.equal(canEnterTerritory(12, 'noria').allowed, true);
  assert.equal(canEnterTerritory(294, 'blood_castle').allowed, false);
  assert.equal(canEnterTerritory(295, 'blood_castle').allowed, true);

  // 2. Grand Reset resets hero to Level 1 AND returns them to City 1 (Lorencia)
  const lateGameHero = {
    ...createInitialPlayerState('dark_knight'),
    level: 300,
    territoryId: 'kanturu_ruins' as const,
    inBloodCastle: true,
    highestReachedTerritoryIdx: 18,
    killsInTerritory: 42,
  };
  const resetRes = performGrandReset(lateGameHero);
  assert.equal(resetRes.success, true);
  assert.equal(resetRes.nextState.level, 1);
  assert.equal(resetRes.nextState.territoryId, 'lorencia');
  assert.equal(resetRes.nextState.inBloodCastle, false);
  assert.equal(resetRes.nextState.highestReachedTerritoryIdx, 0);
  assert.equal(resetRes.nextState.killsInTerritory, 0);

  // 3. Golden Boss is golden-colored and ALWAYS spawns randomly strictly outside Safe Town AND outside all regular/VIP monster camps
  assert.equal(GOLDEN_BOSS_INTERVAL_SEC, 900);
  const lorenciaLayout = getTerritoryMapLayout('lorencia');
  for (let i = 0; i < 20; i++) {
    const pt = pickGoldenBossRandomSpawnPoint('lorencia');
    assert.ok(
      Math.hypot(pt.x, pt.y) >=
        WORLD_TOWN_SAFE_RADIUS + MONSTER_RESPAWN_CONFIG.goldenBoss.minDistFromTownEdgePx,
      'Golden Boss must spawn outside Safe Town buffer'
    );
    for (const camp of lorenciaLayout.camps) {
      assert.ok(
        Math.hypot(pt.x - camp.x, pt.y - camp.y) >=
          MONSTER_RESPAWN_CONFIG.goldenBoss.minDistFromCampPx,
        `Golden Boss (${pt.x},${pt.y}) must spawn outside monster camp ${camp.title}`
      );
    }
  }
  const sampleBoss = createTerritoryBossUnit('lorencia');
  assert.equal(sampleBoss.color, '#fbbf24');
  assert.equal(sampleBoss.isBoss, true);
  assert.ok(sampleBoss.name.includes('Золотой'));

  // 4. 15-minute Server-Time scheduler: max 1 boss per territory, skips the 15-min slot if boss is STILL ALIVE
  const zoneMap = createInitialZoneMonsterMap('lorencia', 900);
  // Slot 1 (t = 900s = 00:15:00): spawns 1 Golden Boss
  const eval1 = evaluateGoldenBoss15MinSpawn(zoneMap, 'lorencia', 900, 0);
  assert.ok(eval1.spawnedBoss, 'Golden Boss should spawn on new 15-minute server slot');
  assert.equal(eval1.nextProcessedSlot, 1);
  assert.equal(eval1.skippedBecauseAlive, false);

  // Slot 2 (t = 1800s = 00:30:00) while Slot 1 Golden Boss is STILL ALIVE:
  // NO second boss spawns, AND slot 2 is consumed (skippedBecauseAlive = true)
  const eval2 = evaluateGoldenBoss15MinSpawn(zoneMap, 'lorencia', 1800, eval1.nextProcessedSlot);
  assert.equal(eval2.spawnedBoss, null, 'Must NOT spawn a second boss while one is alive');
  assert.equal(eval2.skippedBecauseAlive, true);
  assert.equal(eval2.nextProcessedSlot, 2);

  // Player kills the Slot 1 Golden Boss at t = 1860s (inside Slot 2):
  const killRes = applyServerMonsterDamage(
    zoneMap,
    'boss_lorencia',
    eval1.spawnedBoss!.maxHp + 100,
    1860
  );
  assert.equal(killRes.killed, true);
  assert.equal(killRes.respawnAtGameTimeSec, 2700, 'Next respawn must align to Slot 3 (2700s)');

  // Even after death inside Slot 2 (t = 1900s), NO boss spawns during Slot 2 because Slot 2 was skipped!
  const evalStillSlot2 = evaluateGoldenBoss15MinSpawn(
    zoneMap,
    'lorencia',
    1900,
    eval2.nextProcessedSlot
  );
  assert.equal(evalStillSlot2.spawnedBoss, null);

  // When Slot 3 arrives (t = 2700s = 00:45:00), a fresh Golden Boss spawns!
  const eval3 = evaluateGoldenBoss15MinSpawn(
    zoneMap,
    'lorencia',
    2700,
    evalStillSlot2.nextProcessedSlot
  );
  assert.ok(eval3.spawnedBoss, 'Fresh Golden Boss spawns at next 15-minute slot after previous died');
  assert.equal(eval3.nextProcessedSlot, 3);

  // 5. All 24 territories have enriched map details (trails, bridges, lantern posts/landmarks)
  for (const t of TERRITORIES) {
    const layout = getTerritoryMapLayout(t.id);
    assert.ok(layout.trails.length >= 8, `${t.name} should have full trail network`);
    assert.ok(layout.props.length >= 25, `${t.name} should have rich biome props`);
  }
});

test('EXP bar tens-digit (0..9), halved EXP/Zen rates (0.5x), 72 unique non-repeating monsters across all 24 maps, and rich SoundEngine', async () => {
  const { computeExpBarProgress, TERRITORIES } = await import('./rules');
  const { SERVER_CONFIG, MONSTER_RESPAWN_CONFIG } = await import('../config');
  const { TERRITORY_MONSTER_ROSTERS, buildTerritoryUnitBlueprints } = await import('./worldMonsters');
  const { soundEngine } = await import('./sound');

  // 1. Classic MU EXP bar: 0..100% fill + tens digit (1 = 10%, 3 = 30%, ..., 9 = 90..100%)
  assert.deepEqual(computeExpBarProgress(0, 100), { totalPct: 0, segmentDigit: 0 });
  assert.deepEqual(computeExpBarProgress(9, 100), { totalPct: 9, segmentDigit: 0 });
  assert.deepEqual(computeExpBarProgress(10, 100), { totalPct: 10, segmentDigit: 1 });
  assert.deepEqual(computeExpBarProgress(29.9, 100), { totalPct: 29.9, segmentDigit: 2 });
  assert.deepEqual(computeExpBarProgress(30, 100), { totalPct: 30, segmentDigit: 3 });
  assert.deepEqual(computeExpBarProgress(75, 100), { totalPct: 75, segmentDigit: 7 });
  assert.deepEqual(computeExpBarProgress(99.5, 100), { totalPct: 99.5, segmentDigit: 9 });
  assert.deepEqual(computeExpBarProgress(100, 100), { totalPct: 100, segmentDigit: 9 });

  // 2. Halved EXP & Zen server rates applied to monster rewards
  assert.equal(SERVER_CONFIG.rates.expMultiplier, 0.5);
  assert.equal(SERVER_CONFIG.rates.zenMultiplier, 0.5);
  const lorenciaMobs = buildTerritoryUnitBlueprints('lorencia');
  const regularMob = lorenciaMobs.find((m) => !m.isVipRanged);
  assert.ok(regularMob);
  assert.equal(
    regularMob!.expReward,
    Math.round(MONSTER_RESPAWN_CONFIG.unitBaseStats.swarmer_skeleton.expBase * 0.5)
  );
  assert.equal(
    regularMob!.zenReward,
    Math.round(MONSTER_RESPAWN_CONFIG.unitBaseStats.swarmer_skeleton.zenBase * 0.5)
  );

  // 3. ZERO repeating monsters across all 24 maps (72 unique regular monster species!)
  assert.equal(TERRITORIES.length, 24);
  const seenSpeciesToMap = new Map<string, string>();
  for (const t of TERRITORIES) {
    const roster = TERRITORY_MONSTER_ROSTERS[t.id];
    assert.ok(roster && roster.length === 3, `Territory ${t.id} must define 3 unique species`);
    const units = buildTerritoryUnitBlueprints(t.id);
    const mapBaseNames = new Set<string>();
    for (const u of units) {
      const baseName = u.name
        .replace(/^👑 ВИП /, '')
        .replace(/ \(Дальний\)$/, '')
        .trim();
      mapBaseNames.add(baseName);
    }
    assert.equal(mapBaseNames.size, 3, `Territory ${t.id} should spawn all 3 of its unique species`);
    for (const name of mapBaseNames) {
      const prevMap = seenSpeciesToMap.get(name);
      assert.equal(
        prevMap,
        undefined,
        `Monster "${name}" repeated on ${t.id} and ${prevMap}! Every map must have unique monsters.`
      );
      seenSpeciesToMap.set(name, t.id);
    }
  }
  assert.equal(seenSpeciesToMap.size, 72, 'Expected 72 globally unique regular monster species across 24 maps');

  // 4. SoundEngine exposes rich varied sound methods and safely no-ops in Node
  assert.doesNotThrow(() => {
    soundEngine.playAttack('fist');
    soundEngine.playAttack('slash');
    soundEngine.playSkillCast('whirlwind');
    soundEngine.playSkillCast('ice_arrow');
    soundEngine.playSkillCast('meteor_strike');
    soundEngine.playComboBlast();
    soundEngine.playHit(true, 'crit');
    soundEngine.playHit(false, 'double');
    soundEngine.playEnemyDeath(false);
    soundEngine.playEnemyDeath(true);
    soundEngine.playPlayerHurt();
    soundEngine.playDash();
    soundEngine.playZenDrop();
    soundEngine.playZenPickup();
    soundEngine.playJewelDrop();
    soundEngine.playEquipmentDrop(true);
    soundEngine.playLootPickup();
    soundEngine.playItemDrop();
    soundEngine.playPotion('hp');
    soundEngine.playPotion('mp');
    soundEngine.playEquip(true);
    soundEngine.playShopTrade();
    soundEngine.playStatUp();
    soundEngine.playChaosForge(true);
    soundEngine.playChaosForge(false);
    soundEngine.playTeleport();
    soundEngine.playGoldenBossInvasion();
    soundEngine.playLevelUp();
  });
});

test('Server-authoritative monsters patrol, roam, aggro, and attack independently of client tabs; mobile orientation helpers classify viewports accurately', async () => {
  const {
    createInitialZoneMonsterMap,
    createTerritoryBossUnit,
    stepServerZoneMonsters,
  } = await import('./worldMonsters');
  const { isMobilePortraitViewport, isCompactLandscapeViewport } = await import(
    '../utils/mobileOrientation'
  );

  // 1. Server-authoritative monsters move even with 0 players in the zone (so minimizing a player tab never freezes monsters)
  const zoneMap = createInitialZoneMonsterMap('lorencia', 0);
  const boss = createTerritoryBossUnit('lorencia', () => 0.42);
  zoneMap.set(boss.id, boss);

  const trackedRegular = Array.from(zoneMap.values()).find((u) => !u.isBoss)!;
  const startRegX = trackedRegular.x;
  const startRegY = trackedRegular.y;
  const startBossX = boss.x;
  const startBossY = boss.y;

  let nowMs = 1_000_000;
  for (let i = 0; i < 20; i++) {
    nowMs += 100;
    stepServerZoneMonsters(zoneMap, 'lorencia', [], 0.1, nowMs, () => 0.35);
  }

  const regularMoved = Math.hypot(trackedRegular.x - startRegX, trackedRegular.y - startRegY);
  const bossMoved = Math.hypot(boss.x - startBossX, boss.y - startBossY);
  assert.ok(regularMoved > 5, `Regular monster should patrol on server with 0 players, moved ${regularMoved}`);
  assert.ok(bossMoved > 10, `Golden Boss should roam wilderness on server with 0 players, moved ${bossMoved}`);

  // 2. When Player A is AFK in Safe Town (0,0) and Player B stands near a monster outside town,
  // the monster ignores Safe Town and aggros + chases + emits a server attack event against Player B!
  const targetMonster = Array.from(zoneMap.values()).find(
    (u) => !u.isBoss && Math.hypot(u.x, u.y) > 450
  )!;
  const playerA = { id: 'p_afk_town', x: 0, y: 0, hp: 500 }; // Safe town
  const playerB = {
    id: 'p_active_hunter',
    x: targetMonster.x + 65,
    y: targetMonster.y + 10,
    hp: 500,
  };

  let attackEventsCount = 0;
  for (let i = 0; i < 45; i++) {
    nowMs += 100;
    const events = stepServerZoneMonsters(
      zoneMap,
      'lorencia',
      [playerA, playerB],
      0.1,
      nowMs,
      () => 0.5
    );
    attackEventsCount += events.filter((ev) => ev.enemyId === targetMonster.id).length;
  }
  assert.ok(
    attackEventsCount >= 1,
    `Expected server-authoritative monster to emit at least 1 attack event toward active Player B, got ${attackEventsCount}`
  );

  // 3. Monsters must NEVER enter the Safe Town radius (< 335px)
  for (const unit of zoneMap.values()) {
    assert.ok(
      Math.hypot(unit.x, unit.y) >= 330,
      `Monster ${unit.id} crossed into Safe Town at dist ${Math.hypot(unit.x, unit.y)}`
    );
  }

  // 4. Mobile portrait & compact landscape orientation classifiers
  assert.equal(isMobilePortraitViewport(390, 844, true), true, 'Touch phone in portrait must trigger rotate guard');
  assert.equal(isMobilePortraitViewport(390, 844, false), false, 'Desktop narrow window without touch must NOT trigger mobile rotate guard');
  assert.equal(isMobilePortraitViewport(844, 390, true), false, 'Touch phone in landscape must NOT show rotate guard');
  assert.equal(isCompactLandscapeViewport(844, 390), true, '844x390 phone landscape must activate compact landscape mode');
  assert.equal(isCompactLandscapeViewport(667, 375), true, '667x375 small phone landscape must activate compact landscape mode');
  assert.equal(isCompactLandscapeViewport(1440, 900), false, 'Desktop 1440x900 must stay in full desktop mode');
});

test('SQLite accounts start with 0 characters, enforce server-wide unique names & max 3 slots per account, and persist coordinates/HP/MP across reloads', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { GameDatabase, MAX_CHARACTERS_PER_ACCOUNT, validateUniqueCharacterName } = await import(
    '../../server/db'
  );

  // 1. Character name validator rules
  assert.equal(validateUniqueCharacterName('ab').valid, false, 'Names shorter than 3 chars must fail');
  assert.equal(validateUniqueCharacterName('Bad<Name>').valid, false, 'Unsafe symbols must fail');
  assert.equal(validateUniqueCharacterName('Артас_77').valid, true, 'Cyrillic + digits + underscore must pass');
  assert.equal(validateUniqueCharacterName('DarkLord-99').valid, true, 'Latin + hyphen + digits must pass');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mu-account-db-'));
  const dbPath = path.join(tmpDir, 'test-accounts.sqlite');
  const db = new GameDatabase(dbPath);

  try {
    assert.equal(MAX_CHARACTERS_PER_ACCOUNT, 3);

    // 2. First-time visitor account starts with 0 characters
    const acc1 = db.createAccount();
    const acc2 = db.createAccount();
    assert.equal(db.getAccountIdBySessionToken(acc1.sessionToken), acc1.accountId);
    assert.equal(db.getAccountIdBySessionToken('invalid_token'), null);
    assert.equal(db.listAccountCharacters(acc1.accountId).length, 0);

    // 3. Create 1st character on Account 1
    const c1 = db.createCharacterForAccount({
      accountId: acc1.accountId,
      nickname: 'DarkBlade',
      classId: 'dark_knight',
    });
    assert.equal(c1.status, 'ok');
    assert.equal(c1.record.nickname, 'DarkBlade');
    assert.equal(c1.record.accountId, acc1.accountId);
    assert.equal(c1.record.posX, 0);
    assert.equal(c1.record.posY, 220);

    // 4. Server-wide case-insensitive uniqueness check across OTHER accounts
    assert.equal(db.isNicknameAvailable('darkblade').available, false);
    const dupRes = db.createCharacterForAccount({
      accountId: acc2.accountId,
      nickname: 'darkblade',
      classId: 'dark_wizard',
    });
    assert.equal(dupRes.status, 'name_taken');

    // 5. Account 1 creates characters #2 and #3, and 4th is rejected (limit = 3)
    const c2 = db.createCharacterForAccount({
      accountId: acc1.accountId,
      nickname: 'ВолшебникСвета',
      classId: 'dark_wizard',
    });
    const c3 = db.createCharacterForAccount({
      accountId: acc1.accountId,
      nickname: 'FairyQueen',
      classId: 'fairy_elf',
    });
    assert.equal(c2.status, 'ok');
    assert.equal(c3.status, 'ok');
    assert.equal(db.listAccountCharacters(acc1.accountId).length, 3);

    const c4 = db.createCharacterForAccount({
      accountId: acc1.accountId,
      nickname: 'FourthHero',
      classId: 'dark_knight',
    });
    assert.equal(c4.status, 'limit_reached');

    // 6. Save full progress + server coordinates & HP/MP, then verify ownership & reload
    const updatedPlayer = {
      ...c1.record.player,
      level: 28,
      zen: 45_200,
      territoryId: 'devias' as const,
    };
    const saveRes = db.updateCharacterForAccount({
      characterId: c1.record.id,
      accountId: acc1.accountId,
      player: updatedPlayer,
      posX: 640,
      posY: -410,
      currentHp: 215,
      currentMp: 95,
    });
    assert.equal(saveRes.status, 'ok');

    // Cross-account read/write/delete must be forbidden
    assert.equal(db.getCharacterForAccount(c1.record.id, acc2.accountId).status, 'forbidden');
    assert.equal(db.deleteCharacterForAccount(c1.record.id, acc2.accountId), 'forbidden');

    // Server WebSocket runtime vitals checkpoint updates coords & HP/MP without losing gear/Zen
    const vitalsOk = db.updateCharacterRuntimeVitals({
      characterId: c1.record.id,
      accountId: acc1.accountId,
      territoryId: 'devias',
      inBloodCastle: false,
      posX: 725,
      posY: -380,
      currentHp: 180,
      currentMp: 70,
    });
    assert.equal(vitalsOk, true);

    const reloaded = db.getCharacterForAccount(c1.record.id, acc1.accountId);
    assert.equal(reloaded.status, 'ok');
    assert.equal(reloaded.record.player.level, 28);
    assert.equal(reloaded.record.player.zen, 45_200);
    assert.equal(reloaded.record.player.territoryId, 'devias');
    assert.equal(reloaded.record.posX, 725);
    assert.equal(reloaded.record.posY, -380);
    assert.equal(reloaded.record.currentHp, 180);
    assert.equal(reloaded.record.currentMp, 70);

    // 7. Leaderboard sorts strictly by resets DESC, then level DESC
    db.updateCharacterForAccount({
      characterId: c1.record.id,
      accountId: acc1.accountId,
      player: { ...c1.record.player, resets: 1, level: 120 },
    });
    db.updateCharacterForAccount({
      characterId: c2.record.id,
      accountId: acc1.accountId,
      player: { ...c2.record.player, resets: 2, level: 15 },
    });
    db.updateCharacterForAccount({
      characterId: c3.record.id,
      accountId: acc1.accountId,
      player: { ...c3.record.player, resets: 1, level: 260 },
    });
    const leaders = db.listCharacterSummaries(10);
    assert.deepEqual(
      leaders.map((l) => l.nickname),
      ['ВолшебникСвета', 'FairyQueen', 'DarkBlade'],
      'Leaderboard must sort by resets DESC first (2 Res Lv15 > 1 Res Lv260), then level DESC (Lv260 > Lv120)'
    );

    // 8. Deleting a character frees the slot and releases the unique name
    const delRes = db.deleteCharacterForAccount(c3.record.id, acc1.accountId);
    assert.equal(delRes, 'ok');
    assert.equal(db.listAccountCharacters(acc1.accountId).length, 2);
    assert.equal(db.isNicknameAvailable('FairyQueen').available, true);
  } finally {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Manual party rules: no auto-party, 125m EXP sharing & proximity audio boundaries, server ground loot with finder/random mode, and HP/Large HP potion rebalance', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const {
    MAX_WORLD_PLAYERS,
    PARTY_EXP_RANGE_METERS,
    SOUND_HEARING_RANGE_METERS,
    WORLD_UNITS_PER_METER,
    getEligiblePartyExpRecipients,
    isSoundAudibleAt,
    resolvePartyLootRecipient,
    sanitizePartyLootMode,
    worldDistanceToMeters,
  } = await import('./party');
  const { generateMonsterGroundDrops } = await import('./rules');
  const { CHARACTER_SCALING } = await import('../config/characterScaling');
  const { GameDatabase } = await import('../../server/db');

  // 1. Constants & meter scale
  assert.equal(MAX_WORLD_PLAYERS, 64);
  assert.equal(WORLD_UNITS_PER_METER, 10);
  assert.equal(PARTY_EXP_RANGE_METERS, 125);
  assert.equal(SOUND_HEARING_RANGE_METERS, 125);
  assert.equal(worldDistanceToMeters(1250, 0), 125);
  assert.equal(sanitizePartyLootMode('random'), 'random');
  assert.equal(sanitizePartyLootMode('finder'), 'finder');
  assert.equal(sanitizePartyLootMode('invalid'), 'finder');

  // 2. Manual party & 125m EXP sharing boundary
  const makeMember = (id: string, x: number, y: number, territoryId: 'lorencia' | 'devias' = 'lorencia') => ({
    id,
    nickname: id,
    roomCode: 'MU-1',
    partyId: null as string | null,
    classId: 'dark_knight' as const,
    classTier: 1 as const,
    level: 20,
    resets: 0,
    hp: 400,
    maxHp: 400,
    mp: 100,
    maxMp: 100,
    territoryId,
    inBloodCastle: false,
    x,
    y,
    facingAngle: 0,
    walkDistance: 0,
    hasWeapon: true,
    hasWings: false,
    activeSkillPattern: null,
    activeSkillColor: '#f59e0b',
    activeSkillTimestamp: 0,
    lastUpdatedAt: 1_700_000_000_000,
  });

  const killer = makeMember('p_killer', 0, 0);
  const closeAlly = makeMember('p_close', 1250, 0); // exactly 125m -> INCLUDED
  const farAlly = makeMember('p_far', 1260, 0); // 126m -> EXCLUDED
  const otherZoneAlly = makeMember('p_other_zone', 10, 10, 'devias'); // different map -> EXCLUDED
  const outsiderClose = makeMember('p_outsider', 100, 0); // 10m away, NOT in party -> EXCLUDED
  const allMembers = [killer, closeAlly, farAlly, otherZoneAlly, outsiderClose];

  // Solo (party = null): even though other players are 10m away in the same channel, NO auto-party EXP sharing!
  const soloExp = getEligiblePartyExpRecipients(null, allMembers, killer.id, PARTY_EXP_RANGE_METERS);
  assert.deepEqual(soloExp.recipientIds, ['p_killer']);
  assert.equal(soloExp.nearbyAlliesCount, 0);

  // Formed party containing killer + closeAlly + farAlly + otherZoneAlly (NOT outsiderClose)
  const formedParty = {
    partyId: 'pty_1',
    leaderId: 'p_killer',
    memberIds: ['p_killer', 'p_close', 'p_far', 'p_other_zone'],
    lootMode: 'finder' as const,
  };
  const partyExp = getEligiblePartyExpRecipients(
    formedParty,
    allMembers,
    killer.id,
    PARTY_EXP_RANGE_METERS
  );
  assert.deepEqual(partyExp.recipientIds, ['p_killer', 'p_close']);
  assert.equal(partyExp.nearbyAlliesCount, 1);

  // 3. 125m proximity audio boundary
  assert.equal(isSoundAudibleAt(0, 0, 1250, 0), true, 'Exactly 125m must be audible');
  assert.equal(isSoundAudibleAt(0, 0, 1251, 0), false, '125.1m must be silent');
  assert.equal(isSoundAudibleAt(100, 100, 100, 100), true, '0m must be audible');

  // 4. Server ground loot generation & party loot mode ('finder' vs 'random')
  const serverDrops = generateMonsterGroundDrops({
    classId: 'dark_knight',
    territoryId: 'lorencia',
    inBloodCastle: false,
    dropX: 500,
    dropY: 400,
    isBoss: true,
    zenReward: 120,
    isQuestMonster: false,
    allowQuestItem: false,
    nowMs: 1_700_000_000_000,
    rng: () => 0.1,
  });
  assert.ok(serverDrops.length >= 2, 'Boss kill should generate multiple server-authoritative ground drops');
  assert.ok(serverDrops.some((d) => d.type === 'zen'), 'Should include a Zen pile');

  // 'finder' mode always awards to picker
  const finderWinner = resolvePartyLootRecipient(
    formedParty,
    allMembers,
    'p_close',
    500,
    0,
    'lorencia',
    false,
    () => 0.0,
    PARTY_EXP_RANGE_METERS
  );
  assert.equal(finderWinner, 'p_close');

  // 'random' mode picks uniformly among party members in same zone within 125m of drop (drop at 0,0 -> p_killer & p_close eligible; p_far at 1260 excluded; p_other_zone excluded)
  const randomParty = { ...formedParty, lootMode: 'random' as const };
  const randWinner0 = resolvePartyLootRecipient(
    randomParty,
    allMembers,
    'p_close',
    0,
    0,
    'lorencia',
    false,
    () => 0.01,
    PARTY_EXP_RANGE_METERS
  );
  assert.equal(randWinner0, 'p_killer');

  const randWinner1 = resolvePartyLootRecipient(
    randomParty,
    allMembers,
    'p_killer',
    0,
    0,
    'lorencia',
    false,
    () => 0.99,
    PARTY_EXP_RANGE_METERS
  );
  assert.equal(randWinner1, 'p_close');

  // 5. HP & Large HP potion rebalance (250 HP / 500 HP, 0.45s fast cooldown, 10x price)
  assert.equal(CHARACTER_SCALING.potions.smallHpHeal, 250);
  assert.equal(CHARACTER_SCALING.potions.largeHpHeal, 500);
  assert.equal(CHARACTER_SCALING.potions.hpCooldownSec, 0.45);
  assert.equal(
    CHARACTER_SCALING.potions.largeHpUnitPrice,
    CHARACTER_SCALING.potions.smallHpUnitPrice * 10
  );

  const shopper = { ...createInitialPlayerState('dark_knight'), zen: 15_000 };
  assert.equal(shopper.largeHpPotions, 0);

  const buySmall = buyPotionsWithZen(shopper, 'hp', 5, true);
  assert.equal(buySmall.success, true);
  assert.equal(buySmall.nextState.zen, 15_000 - 250);
  assert.equal(buySmall.nextState.hpPotions, shopper.hpPotions + 5);

  const buyLarge5 = buyPotionsWithZen(buySmall.nextState, 'large_hp', 5, true);
  assert.equal(buyLarge5.success, true);
  assert.equal(buyLarge5.nextState.zen, 14_750 - 2500);
  assert.equal(buyLarge5.nextState.largeHpPotions, 5);

  const buyLarge20 = buyPotionsWithZen(buyLarge5.nextState, 'large_hp', 20, true);
  assert.equal(buyLarge20.success, true);
  assert.equal(buyLarge20.nextState.zen, 12_250 - 9000);
  assert.equal(buyLarge20.nextState.largeHpPotions, 25);

  // 6. SQLite GameDatabase round-trip persistence for largeHpPotions
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mu-large-pot-db-'));
  const dbPath = path.join(tmpDir, 'test-pots.sqlite');
  const db = new GameDatabase(dbPath);
  try {
    const acc = db.createAccount();
    const created = db.createCharacterForAccount({
      accountId: acc.accountId,
      nickname: 'PotionTester',
      classId: 'dark_knight',
    });
    assert.equal(created.status, 'ok');
    assert.equal(created.record.player.largeHpPotions, 0);

    const saved = db.updateCharacterForAccount({
      characterId: created.record.id,
      accountId: acc.accountId,
      player: { ...created.record.player, hpPotions: 17, largeHpPotions: 25 },
    });
    assert.equal(saved.status, 'ok');

    const loaded = db.getCharacterForAccount(created.record.id, acc.accountId);
    assert.equal(loaded.status, 'ok');
    assert.equal(loaded.record.player.hpPotions, 17);
    assert.equal(loaded.record.player.largeHpPotions, 25);
  } finally {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

