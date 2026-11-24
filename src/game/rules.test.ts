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

  // Grand Reset #1 requires Level 300 and 100,000 Zen
  const earlyReset = performGrandReset({ ...evo.nextState, level: 299, zen: 150_000 });
  assert.equal(earlyReset.success, false);

  const brokeReset = performGrandReset({ ...evo.nextState, level: 300, zen: 50_000 });
  assert.equal(brokeReset.success, false);

  const validReset = performGrandReset({
    ...evo.nextState,
    level: 300,
    zen: 120_000,
    attributes: { str: 250, agi: 320, vit: 180, ene: 90 },
    statPoints: 45,
  });
  assert.equal(validReset.success, true);
  assert.equal(validReset.nextState.resets, 1);
  assert.equal(validReset.nextState.level, 1);
  assert.equal(validReset.nextState.zen, 20_000);
  // All allocated & unspent points are burned back to base class attributes and replaced with 1 * 350 = 350 points
  assert.deepEqual(validReset.nextState.attributes, CLASSES.fairy_elf.baseAttributes);
  assert.equal(validReset.nextState.statPoints, 350);
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

  // Verify Grand Reset burns old allocated points, grants 350 points on Reset #1, and still boosts power strongly
  const lvl300Hero = {
    ...createInitialPlayerState('dark_knight'),
    level: 300,
    zen: 150_000,
    attributes: { str: 400, agi: 250, vit: 200, ene: 100 },
  };
  const beforeResetStats = calculateDerivedStats(lvl300Hero);
  const afterReset = performGrandReset(lvl300Hero);
  assert.equal(afterReset.success, true);
  assert.deepEqual(afterReset.nextState.attributes, CLASSES.dark_knight.baseAttributes);
  assert.equal(afterReset.nextState.statPoints, 350);
  const afterAllocResetStats = calculateDerivedStats({
    ...afterReset.nextState,
    attributes: {
      ...afterReset.nextState.attributes,
      str: afterReset.nextState.attributes.str + 250,
      agi: afterReset.nextState.attributes.agi + 100,
    },
    statPoints: 0,
  });
  assert.ok(afterAllocResetStats.maxDamage > beforeResetStats.maxDamage * 1.25);
  assert.ok(afterAllocResetStats.defense > beforeResetStats.defense * 1.25);
});

test('Blood Castle Ticket crafting uses 1 Blood Scroll + 1 Blood Fang + 1 Jewel of Chaos with 80% success rate, and quest completion awards probabilistic 1-3 Jewel of Chaos and EXP', async () => {
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

  // Completing the 4-stage Blood Castle quest awards rolled Jewel of Chaos (roll 0.99 -> 3), massive EXP, and Zen
  const completed = completeBloodCastleQuest(entered.nextState, 0.99);
  assert.equal(completed.chaosReward, 3);
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
    zen: 100_000,
    territoryId: 'kanturu_ruins' as const,
    inBloodCastle: true,
    highestReachedTerritoryIdx: 18,
    killsInTerritory: 42,
  };
  const resetRes = performGrandReset(lateGameHero);
  assert.equal(resetRes.success, true);
  assert.equal(resetRes.nextState.level, 1);
  assert.equal(resetRes.nextState.zen, 0);
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

test('Single-session deduplication evicts duplicate account/character/browser tabs while allowing distinct players', async () => {
  const {
    WS_CLOSE_SESSION_REPLACED,
    findDuplicateSessionClientIds,
    sanitizeClientSessionKey,
  } = await import('./party');

  assert.equal(WS_CLOSE_SESSION_REPLACED, 4001);
  assert.equal(sanitizeClientSessionKey('cs_abc123_xyz789'), 'cs_abc123_xyz789');
  assert.equal(sanitizeClientSessionKey('short'), null);
  assert.equal(sanitizeClientSessionKey('<script>alert(1)</script>'), null);
  assert.equal(sanitizeClientSessionKey(null), null);

  const activeSessions = [
    {
      id: 'hero_tab1',
      accountId: 'acc_player_1',
      characterId: 'char_knight_1',
      clientSessionKey: 'cs_browser_A_001',
    },
    {
      id: 'hero_other_player',
      accountId: 'acc_player_2',
      characterId: 'char_elf_2',
      clientSessionKey: 'cs_browser_B_002',
    },
    {
      id: 'hero_cookieless_tab1',
      accountId: null,
      characterId: null,
      clientSessionKey: 'cs_browser_C_003',
    },
  ];

  // 1. Opening a second tab in the same browser (same accountId + same browser session) evicts tab 1, NOT other players
  const dupByAccount = findDuplicateSessionClientIds(activeSessions, {
    id: 'hero_tab2',
    accountId: 'acc_player_1',
    characterId: 'char_knight_1',
    clientSessionKey: 'cs_browser_A_001',
  });
  assert.deepEqual(dupByAccount, ['hero_tab1']);

  // 2. Logging into a different character on the same account from another device still evicts the account's active tab
  const dupSameAccountDiffChar = findDuplicateSessionClientIds(activeSessions, {
    id: 'hero_mobile_tab',
    accountId: 'acc_player_1',
    characterId: 'char_wizard_99',
    clientSessionKey: 'cs_mobile_D_004',
  });
  assert.deepEqual(dupSameAccountDiffChar, ['hero_tab1']);

  // 3. Same characterId (even if accountId is absent) evicts the old character instance
  const dupByCharOnly = findDuplicateSessionClientIds(activeSessions, {
    id: 'hero_char_dup',
    accountId: null,
    characterId: 'char_elf_2',
    clientSessionKey: null,
  });
  assert.deepEqual(dupByCharOnly, ['hero_other_player']);

  // 4. Cookie-less fallback (e.g. strict iframe) matches by browser clientSessionKey
  const dupByBrowserKey = findDuplicateSessionClientIds(activeSessions, {
    id: 'hero_cookieless_tab2',
    accountId: null,
    characterId: null,
    clientSessionKey: 'cs_browser_C_003',
  });
  assert.deepEqual(dupByBrowserKey, ['hero_cookieless_tab1']);

  // 5. Completely distinct player (different account, character, and browser key) evicts nobody
  const noDupDistinctPlayer = findDuplicateSessionClientIds(activeSessions, {
    id: 'hero_player_3',
    accountId: 'acc_player_3',
    characterId: 'char_wizard_3',
    clientSessionKey: 'cs_browser_E_005',
  });
  assert.deepEqual(noDupDistinctPlayer, []);

  // 6. Re-joining on the exact same socket id never evicts itself
  const noSelfEvict = findDuplicateSessionClientIds(activeSessions, activeSessions[0]);
  assert.deepEqual(noSelfEvict, []);
});

test('Grand Reset burns all previous allocated & unspent points and awards 350 * resetNumber points (1->350, 2->700, 3->1050)', async () => {
  const { performGrandReset, allocateStatPoint } = await import('./rules');
  const { CHARACTER_SCALING } = await import('../config/characterScaling');

  assert.equal(CHARACTER_SCALING.grandReset.bonusStatPoints, 350);

  // Start as Dark Wizard, allocate heavy stats and reach level 300 with leftover points and 500,000 Zen
  let hero = {
    ...createInitialPlayerState('dark_wizard'),
    level: 300,
    zen: 500_000,
    attributes: { str: 120, agi: 240, vit: 310, ene: 780 },
    statPoints: 99,
  };

  // Reset #1 -> requires Level 300 and 100,000 Zen; all allocated stats burned to baseAttributes, statPoints strictly 350
  const r1 = performGrandReset(hero);
  assert.equal(r1.success, true);
  assert.equal(r1.nextState.resets, 1);
  assert.equal(r1.nextState.level, 1);
  assert.equal(r1.nextState.zen, 400_000);
  assert.deepEqual(r1.nextState.attributes, CLASSES.dark_wizard.baseAttributes);
  assert.equal(r1.nextState.statPoints, 350);

  // Spend all 350 points + level back to 305 (required for Reset #2) with even more allocated stats
  hero = allocateStatPoint(r1.nextState, 'ene', 350);
  assert.equal(hero.statPoints, 0);
  assert.equal(hero.attributes.ene, CLASSES.dark_wizard.baseAttributes.ene + 350);
  hero = {
    ...hero,
    level: 305,
    attributes: { str: 50, agi: 400, vit: 500, ene: 1200 },
    statPoints: 120,
  };

  // Reset #2 -> requires Level 305 and 150,000 Zen; all previous points burned to baseAttributes, statPoints strictly 700
  const r2 = performGrandReset(hero);
  assert.equal(r2.success, true);
  assert.equal(r2.nextState.resets, 2);
  assert.equal(r2.nextState.zen, 250_000);
  assert.deepEqual(r2.nextState.attributes, CLASSES.dark_wizard.baseAttributes);
  assert.equal(r2.nextState.statPoints, 700);

  // Reset #3 -> requires Level 310 and 200,000 Zen; all previous points burned to baseAttributes, statPoints strictly 1050
  const r3 = performGrandReset({
    ...r2.nextState,
    level: 310,
    attributes: { str: 300, agi: 600, vit: 400, ene: 1500 },
    statPoints: 50,
  });
  assert.equal(r3.success, true);
  assert.equal(r3.nextState.resets, 3);
  assert.equal(r3.nextState.zen, 50_000);
  assert.deepEqual(r3.nextState.attributes, CLASSES.dark_wizard.baseAttributes);
  assert.equal(r3.nextState.statPoints, 1050);
});

test('extractServerOnlinePlayers returns exact online count and strictly nicknames with online status sorted across all rooms', async () => {
  const { extractServerOnlinePlayers } = await import('./party');

  const empty = extractServerOnlinePlayers([]);
  assert.equal(empty.count, 0);
  assert.deepEqual(empty.players, []);

  const summary = extractServerOnlinePlayers([
    {
      members: [{ nickname: 'Богдан' }, { nickname: 'Артур' }],
    },
    {
      members: [{ nickname: 'Воин-777' }],
    },
  ]);

  assert.equal(summary.count, 3);
  assert.deepEqual(summary.players, [
    { nickname: 'Артур', status: 'online' },
    { nickname: 'Богдан', status: 'online' },
    { nickname: 'Воин-777', status: 'online' },
  ]);
  // Ensure no extra fields leak beyond nickname and status
  for (const p of summary.players) {
    assert.deepEqual(Object.keys(p).sort(), ['nickname', 'status']);
  }
});

test('Blood Castle death enforces single attempt (exits to origin city) and completion Chaos reward follows 80%/18%/2% distribution', async () => {
  const {
    enterBloodCastle,
    resolvePlayerDeathInZone,
    rollBloodCastleChaosReward,
    completeBloodCastleQuest,
  } = await import('./rules');
  const { BLOOD_CASTLE_CONFIG } = await import('../config/respawns');

  // 1. Verify exact probability config sums to 100%
  const chances = BLOOD_CASTLE_CONFIG.questRewards.chaosRewardChances;
  assert.equal(chances.oneChaosChance, 0.8);
  assert.equal(chances.twoChaosChance, 0.18);
  assert.equal(chances.threeChaosChance, 0.02);
  assert.ok(Math.abs(chances.oneChaosChance + chances.twoChaosChance + chances.threeChaosChance - 1) < 1e-9);

  // 2. Boundary checks for rollBloodCastleChaosReward
  // 80%: [0, 0.80) -> 1 Chaos
  assert.equal(rollBloodCastleChaosReward(0), 1);
  assert.equal(rollBloodCastleChaosReward(0.45), 1);
  assert.equal(rollBloodCastleChaosReward(0.7999), 1);
  // 18%: [0.80, 0.98) -> 2 Chaos
  assert.equal(rollBloodCastleChaosReward(0.8), 2);
  assert.equal(rollBloodCastleChaosReward(0.9), 2);
  assert.equal(rollBloodCastleChaosReward(0.9799), 2);
  // 2%: [0.98, 1.0) -> 3 Chaos
  assert.equal(rollBloodCastleChaosReward(0.98), 3);
  assert.equal(rollBloodCastleChaosReward(0.995), 3);
  assert.equal(rollBloodCastleChaosReward(0.9999), 3);

  // 3. Uniform 1000-bucket distribution verification: strictly 800 / 180 / 20
  const counts = { 1: 0, 2: 0, 3: 0 };
  for (let i = 0; i < 1000; i++) {
    const rolled = rollBloodCastleChaosReward((i + 0.5) / 1000);
    counts[rolled] += 1;
  }
  assert.equal(counts[1], 800);
  assert.equal(counts[2], 180);
  assert.equal(counts[3], 20);

  // 4. completeBloodCastleQuest awards exact rolled Chaos count
  const heroInBc = {
    ...createInitialPlayerState('dark_knight'),
    territoryId: 'devias' as const,
    bloodCastleTickets: 1,
  };
  const entered = enterBloodCastle(heroInBc);
  assert.equal(entered.success, true);
  assert.equal(entered.nextState.inBloodCastle, true);
  assert.equal(entered.nextState.territoryId, 'devias');
  assert.equal(entered.nextState.bloodCastleTickets, 0);

  const c1 = completeBloodCastleQuest(entered.nextState, 0.25);
  assert.equal(c1.chaosReward, 1);
  assert.equal(c1.nextState.jewels.chaos, entered.nextState.jewels.chaos + 1);

  const c2 = completeBloodCastleQuest(entered.nextState, 0.85);
  assert.equal(c2.chaosReward, 2);
  assert.equal(c2.nextState.jewels.chaos, entered.nextState.jewels.chaos + 2);

  const c3 = completeBloodCastleQuest(entered.nextState, 0.99);
  assert.equal(c3.chaosReward, 3);
  assert.equal(c3.nextState.jewels.chaos, entered.nextState.jewels.chaos + 3);

  // 5. Dying inside Blood Castle immediately kicks hero out to their exact origin city (Devias) — only 1 attempt!
  const deathInBc = resolvePlayerDeathInZone(entered.nextState);
  assert.equal(deathInBc.exitedBloodCastle, true);
  assert.equal(deathInBc.nextState.inBloodCastle, false);
  assert.equal(deathInBc.nextState.territoryId, 'devias');
  assert.equal(deathInBc.originTerritoryId, 'devias');
  // Re-entering without another ticket is rejected
  const retryAttempt = enterBloodCastle(deathInBc.nextState);
  assert.equal(retryAttempt.success, false);
  assert.equal(retryAttempt.nextState.inBloodCastle, false);

  // 6. Dying outside Blood Castle keeps hero in their current territory (e.g. Noria)
  const heroInNoria = {
    ...createInitialPlayerState('fairy_elf'),
    territoryId: 'noria' as const,
    inBloodCastle: false,
  };
  const deathInNoria = resolvePlayerDeathInZone(heroInNoria);
  assert.equal(deathInNoria.exitedBloodCastle, false);
  assert.equal(deathInNoria.nextState.inBloodCastle, false);
  assert.equal(deathInNoria.nextState.territoryId, 'noria');
});

test('Wings grant +1% max movement speed per upgrade level (+0..+15), scale larger visually with level, and armor sets & weapons resolve to distinct visual tiers', async () => {
  const { calculateWingUpgradeBonus, craftChaosWings } = await import('./rules');
  const {
    getWingVisualMetrics,
    resolveArmorSetVisualStyle,
    resolveWeaponVisualStyle,
  } = await import('./models');

  // 1. Verify +1% speed bonus per wing upgrade level (+0..+15) and visual growth
  const basePlayer = {
    ...createInitialPlayerState('dark_knight'),
    zen: 10000,
    jewels: { bless: 10, soul: 10, life: 10, chaos: 5 },
    // Give high AGI so hero reaches standard moveSpeedCap (350)
    attributes: { str: 100, agi: 300, vit: 100, ene: 100 },
  };
  const noWingStats = calculateDerivedStats(basePlayer);
  assert.equal(noWingStats.moveSpeed, 350);

  const crafted = craftChaosWings(basePlayer);
  assert.equal(crafted.success, true);
  const wings0 = { ...crafted.craftedWings!, level: 0 };
  const wings5 = { ...crafted.craftedWings!, level: 5 };
  const wings10 = { ...crafted.craftedWings!, level: 10 };
  const wings15 = { ...crafted.craftedWings!, level: 15 };

  assert.equal(calculateWingUpgradeBonus(wings0).speedBonusPct, 0);
  assert.equal(calculateWingUpgradeBonus(wings5).speedBonusPct, 5);
  assert.equal(calculateWingUpgradeBonus(wings10).speedBonusPct, 10);
  assert.equal(calculateWingUpgradeBonus(wings15).speedBonusPct, 15);

  const stats0 = calculateDerivedStats({
    ...basePlayer,
    equipped: { ...basePlayer.equipped, wings: wings0 },
  });
  const stats5 = calculateDerivedStats({
    ...basePlayer,
    equipped: { ...basePlayer.equipped, wings: wings5 },
  });
  const stats10 = calculateDerivedStats({
    ...basePlayer,
    equipped: { ...basePlayer.equipped, wings: wings10 },
  });
  const stats15 = calculateDerivedStats({
    ...basePlayer,
    equipped: { ...basePlayer.equipped, wings: wings15 },
  });

  // +0 wings at max speed cap = 350; +5 = 350 * 1.05 = 368; +10 = 350 * 1.10 = 385; +15 = 350 * 1.15 = 403
  assert.equal(stats0.moveSpeed, 350);
  assert.equal(stats5.moveSpeed, Math.round(350 * 1.05));
  assert.equal(stats10.moveSpeed, Math.round(350 * 1.1));
  assert.equal(stats15.moveSpeed, Math.round(350 * 1.15));

  // 2. Verify wing visual size grows monotonically with upgrade level (+0 < +5 < +10 < +15)
  const vis0 = getWingVisualMetrics(wings0, 'dark_knight');
  const vis5 = getWingVisualMetrics(wings5, 'dark_knight');
  const vis10 = getWingVisualMetrics(wings10, 'dark_knight');
  const vis15 = getWingVisualMetrics(wings15, 'dark_knight');
  assert.ok(vis0.effectiveSpan < vis5.effectiveSpan);
  assert.ok(vis5.effectiveSpan < vis10.effectiveSpan);
  assert.ok(vis10.effectiveSpan < vis15.effectiveSpan);

  // 3. Verify distinct armor set visual tiers across early, mid, and endgame sets
  const dkLeather = resolveArmorSetVisualStyle(
    'dark_knight',
    {
      ...CLASSES.dark_knight.startingArmor,
      name: 'Кожаный Доспех Лоренсии',
      rarity: 'normal',
      baseDefense: 12,
    },
    null
  );
  const dkBlackDragon = resolveArmorSetVisualStyle(
    'dark_knight',
    {
      ...CLASSES.dark_knight.startingArmor,
      name: 'Латы Чёрного Феникса',
      rarity: 'excellent',
      baseDefense: 55,
    },
    null
  );
  const dkTitan = resolveArmorSetVisualStyle(
    'dark_knight',
    {
      ...CLASSES.dark_knight.startingArmor,
      name: 'Anc. Доспех Великого Титана',
      rarity: 'ancient',
      baseDefense: 150,
    },
    null
  );
  assert.equal(dkLeather.tier, 1);
  assert.equal(dkBlackDragon.tier, 3);
  assert.equal(dkTitan.tier, 5);
  assert.notEqual(dkLeather.styleId, dkBlackDragon.styleId);
  assert.notEqual(dkBlackDragon.styleId, dkTitan.styleId);

  // 4. Verify distinct weapon visual archetypes across classes and weapon families
  assert.equal(
    resolveWeaponVisualStyle('dark_knight', {
      ...CLASSES.dark_knight.startingWeapon,
      name: 'Короткий Меч Лоренсии',
      rarity: 'normal',
      baseAttack: 18,
    }).archetype,
    'dk_short_sword'
  );
  assert.equal(
    resolveWeaponVisualStyle('dark_knight', {
      ...CLASSES.dark_knight.startingWeapon,
      name: 'Трезубец Атланса',
      rarity: 'magic',
      baseAttack: 64,
    }).archetype,
    'dk_atlans_trident'
  );
  assert.equal(
    resolveWeaponVisualStyle('dark_knight', {
      ...CLASSES.dark_knight.startingWeapon,
      name: 'Коса Балрога',
      rarity: 'excellent',
      baseAttack: 85,
    }).archetype,
    'dk_balrog_scythe'
  );
  assert.equal(
    resolveWeaponVisualStyle('dark_knight', {
      ...CLASSES.dark_knight.startingWeapon,
      name: 'Божественный Меч Архангела',
      rarity: 'ancient',
      baseAttack: 180,
    }).archetype,
    'dk_archangel_flameblade'
  );
  assert.equal(
    resolveWeaponVisualStyle('fairy_elf', {
      ...CLASSES.fairy_elf.startingWeapon,
      name: 'Арбалет Святого Духа',
      rarity: 'excellent',
      baseAttack: 65,
    }).archetype,
    'elf_holy_crossbow'
  );
});

test('Every differently named weapon, armor set, and helm across all 3 classes resolves to a unique visual style and Excellent (Exe) items enable soft emerald-green luminescence', async () => {
  const { resolveArmorSetVisualStyle, resolveWeaponVisualStyle } = await import('./models');
  const { CLASSES, getShopEquipmentCatalog } = await import('./rules');

  const classWeaponNames = {
    dark_knight: [
      'Короткий Меч Лоренсии',
      'Клинок Хаоса',
      'Клинок Изумрудной Нории',
      'Рунный Меч Эльбеланда',
      'Ледяной Клинок Девиаса',
      'Клинок Разрушения',
      'Трезубец Атланса',
      'Коса Балрога',
      'Клинок Заикана Таркана',
      'Меч Огненного Феникса',
      'Клинок Бездны Калимы',
      'Королевский Меч Лорена',
      'Божественный Меч Архангела',
    ],
    dark_wizard: [
      'Ученический Посох Лоренсии',
      'Посох Легендарной Души',
      'Посох Древней Нории',
      'Жезл Иллюзий Эльбеланда',
      'Ледяной Посох Девиаса',
      'Посох Души Дракона',
      'Посох Вод Атланса',
      'Посох Пламени Балрога',
      'Жезл Песков Таркана',
      'Посох Небес Икаруса',
      'Жезл Оракула Калимы',
      'Скипетр Империи Кантуру',
      'Посох Архангела Кундуна',
    ],
    fairy_elf: [
      'Короткий Лук Лоренсии',
      'Лук Серебряного Крыла',
      'Лук Королевы Нории',
      'Лук Ветров Эльбеланда',
      'Хрустальный Лук Девиаса',
      'Арбалет Святого Духа',
      'Коралловый Лук Атланса',
      'Лук Хаоса Башни',
      'Лук Золотых Песков',
      'Крылатый Лук Икаруса',
      'Арбалет Кошмара Кантуру',
      'Лук Ледяного Раклиона',
      'Божественный Арбалет Архангела',
    ],
  } as const;

  const classArmorNames = {
    dark_knight: [
      'Кожаный Доспех Лоренсии',
      'Кираса Чёрного Дракона',
      'Броня Стража Нории',
      'Доспех Рыцаря Эльбеланда',
      'Латы Северного Девиаса',
      'Латы Чёрного Феникса',
      'Чешуйчатый Доспех Атланса',
      'Броня Повелителя Башни',
      'Латы Пустынного Титана',
      'Доспех Небесного Дракона',
      'Броня Императора Кантуру',
      'Кираса Вечного Льда',
      'Доспех Великого Титана',
    ],
    dark_wizard: [
      'Холщовая Мантия Лоренсии',
      'Мантия Анубиса',
      'Мантия Мудреца Нории',
      'Роба Туманов Эльбеланда',
      'Мантия Вьюги Девиаса',
      'Мантия Легендарного Духа',
      'Одеяние Бездны Атланса',
      'Мантия Затмения Башни',
      'Мантия Бури Таркана',
      'Одеяние Звёздного Икаруса',
      'Роба Реликвий Кантуру',
      'Мантия Пентаграмм Ахерона',
      'Мантия Вечности Кундуна',
    ],
    fairy_elf: [
      'Лёгкая Туника Лоренсии',
      'Доспех Стража Нории',
      'Туника Луны Эльбеланда',
      'Одеяние Снегов Девиаса',
      'Одеяние Красного Духа',
      'Латы Сирены Атланса',
      'Доспех Валькирии Башни',
      'Одеяние Оазиса Таркана',
      'Крылатый Доспех Икаруса',
      'Броня Стража Крайвульфа',
      'Латы Хрустальной Никси',
      'Божественные Латы Сильфиды',
    ],
  } as const;

  const classHelmNames = {
    dark_knight: [
      'Кожаный Шлем Лоренсии',
      'Шлем Чёрного Дракона',
      'Шлем Стража Нории',
      'Корона Эльбеланда',
      'Шлем Льдов Девиаса',
      'Шлем Чёрного Феникса',
      'Шлем Глубин Атланса',
      'Рогатый Шлем Балрога',
      'Шлем Песчаной Бури',
      'Корона Небесного Феникса',
      'Шлем Титана Кантуру',
      'Корона Фереи',
      'Корона Великого Титана',
    ],
    dark_wizard: [
      'Повязка Ученика Лоренсии',
      'Венец Анубиса',
      'Венец Нории',
      'Диадема Эльбеланда',
      'Корона Стужи Девиаса',
      'Венец Легендарного Духа',
      'Тиара Атланса',
      'Корона Затмения',
      'Венец Оракула Таркана',
      'Диадема Икаруса',
      'Венец Кошмара Кантуру',
      'Корона Ахерона',
      'Корона Вечности',
    ],
    fairy_elf: [
      'Обруч Рощи Лоренсии',
      'Диадема Стража Нории',
      'Тиара Эльбеланда',
      'Венец Льдов Девиаса',
      'Тиара Красного Духа',
      'Корона Сирены Атланса',
      'Диадема Валькирии',
      'Тиара Песков Таркана',
      'Венец Облаков Икаруса',
      'Корона Алтаря Волка',
      'Диадема Озера Никси',
      'Корона Сильфиды',
    ],
  } as const;

  for (const classId of ['dark_knight', 'dark_wizard', 'fairy_elf'] as const) {
    // 1. All 13 named weapons per class resolve to 13 unique archetypes/weaponIds
    const seenWeapons = new Set<string>();
    for (const wName of classWeaponNames[classId]) {
      const style = resolveWeaponVisualStyle(classId, {
        ...CLASSES[classId].startingWeapon,
        name: wName,
        rarity: 'normal',
      });
      assert.equal(
        seenWeapons.has(style.weaponId),
        false,
        `Duplicate weaponId ${style.weaponId} for weapon "${wName}" (${classId})`
      );
      seenWeapons.add(style.weaponId);
      assert.equal(style.hasExcellentGreenGlow, false);

      // Excellent variant of the same weapon activates soft green glow while keeping its unique weaponId
      const exeStyle = resolveWeaponVisualStyle(classId, {
        ...CLASSES[classId].startingWeapon,
        name: `Exc. ${wName}`,
        rarity: 'excellent',
      });
      assert.equal(exeStyle.weaponId, style.weaponId);
      assert.equal(exeStyle.hasExcellentGreenGlow, true);
      assert.equal(exeStyle.excellentGlowColor, '#34d399');
    }
    assert.equal(seenWeapons.size, 13);

    // 2. All named armors per class resolve to unique styleIds and chestMotifs
    const seenArmors = new Set<string>();
    for (const aName of classArmorNames[classId]) {
      const style = resolveArmorSetVisualStyle(
        classId,
        {
          ...CLASSES[classId].startingArmor,
          name: aName,
          rarity: 'normal',
        },
        null
      );
      assert.equal(
        seenArmors.has(style.styleId),
        false,
        `Duplicate armor styleId ${style.styleId} for armor "${aName}" (${classId})`
      );
      seenArmors.add(style.styleId);
      assert.equal(style.hasArmorExcellentGlow, false);
      assert.equal(style.hasExcellentGreenGlow, false);

      const exeArmorStyle = resolveArmorSetVisualStyle(
        classId,
        {
          ...CLASSES[classId].startingArmor,
          name: `Exc. ${aName}`,
          rarity: 'excellent',
        },
        null
      );
      assert.equal(exeArmorStyle.styleId, style.styleId);
      assert.equal(exeArmorStyle.hasArmorExcellentGlow, true);
      assert.equal(exeArmorStyle.hasExcellentGreenGlow, true);
      assert.equal(exeArmorStyle.excellentGlowColor, '#34d399');
    }
    assert.equal(seenArmors.size, classArmorNames[classId].length);

    // 3. All named helms per class resolve to unique helmStyleIds and helmMotifs
    const seenHelms = new Set<string>();
    for (const hName of classHelmNames[classId]) {
      const style = resolveArmorSetVisualStyle(classId, null, {
        ...CLASSES[classId].startingHelm,
        name: hName,
        rarity: 'normal',
      });
      assert.equal(
        seenHelms.has(style.helmStyleId),
        false,
        `Duplicate helmStyleId ${style.helmStyleId} for helm "${hName}" (${classId})`
      );
      seenHelms.add(style.helmStyleId);
      assert.equal(style.hasHelmExcellentGlow, false);

      const exeHelmStyle = resolveArmorSetVisualStyle(classId, null, {
        ...CLASSES[classId].startingHelm,
        name: `Exc. ${hName}`,
        rarity: 'excellent',
      });
      assert.equal(exeHelmStyle.helmStyleId, style.helmStyleId);
      assert.equal(exeHelmStyle.hasHelmExcellentGlow, true);
      assert.equal(exeHelmStyle.hasExcellentGreenGlow, true);
    }
    assert.equal(seenHelms.size, classHelmNames[classId].length);

    // 4. Shop catalog items for each class have unique names and distinct visual styles per slot
    const catalog = getShopEquipmentCatalog(classId);
    const catalogNames = catalog.map((c) => c.itemTemplate.name);
    assert.equal(new Set(catalogNames).size, catalogNames.length);
  }
});

test('Upgrade level (+1..+15) modifies item color and glow (+1..+6 blue-darkens, +6..+9 glows brightly in base primary color, +10..+15 adds subtle white sheen) and Ancient tier uses purple (#c084fc) with same glow as Excellent', async () => {
  const {
    resolveArmorSetVisualStyle,
    resolveItemUpgradeColorEffect,
    resolveWeaponVisualStyle,
  } = await import('./models');
  const { getEquipmentRarityColor } = await import('./party');
  const { CLASSES } = await import('./rules');

  // 1. Ancient tier is purple (#c084fc) in ground/rarity helpers and carries purple glow flags matching Excellent
  assert.equal(getEquipmentRarityColor('ancient'), '#c084fc');
  assert.equal(getEquipmentRarityColor('excellent'), '#34d399');

  const ancSword = resolveWeaponVisualStyle('dark_knight', {
    ...CLASSES.dark_knight.startingWeapon,
    name: 'Anc. Клинок Разрушения',
    rarity: 'ancient',
    level: 0,
  });
  assert.equal(ancSword.hasAncientPurpleGlow, true);
  assert.equal(ancSword.ancientGlowColor, '#c084fc');

  const ancArmor = resolveArmorSetVisualStyle(
    'dark_wizard',
    {
      ...CLASSES.dark_wizard.startingArmor,
      name: 'Anc. Мантия Анубиса',
      rarity: 'ancient',
      level: 0,
    },
    null
  );
  assert.equal(ancArmor.hasArmorAncientGlow, true);
  assert.equal(ancArmor.hasAncientPurpleGlow, true);
  assert.equal(ancArmor.ancientGlowColor, '#c084fc');

  // 2. +0 item keeps base primary color without blue-darkening, primary glow, or white sheen
  const lvl0 = resolveItemUpgradeColorEffect(0, '#991b1b', '#1f090d');
  assert.equal(lvl0.isBlueDarkened, false);
  assert.equal(lvl0.hasBrightPrimaryGlow, false);
  assert.equal(lvl0.hasSubtleWhiteSheen, false);
  assert.equal(lvl0.tintedPrimaryColor, '#991b1b');

  // 3. +1 to +6 items slightly shift darker & bluer
  for (let lvl = 1; lvl <= 6; lvl++) {
    const eff = resolveItemUpgradeColorEffect(lvl, '#991b1b', '#1f090d');
    assert.equal(eff.isBlueDarkened, true, `Level +${lvl} should be blue-darkened`);
    assert.ok(eff.blueDarkenFactor > 0);
    assert.notEqual(eff.tintedPrimaryColor, '#991b1b');
  }

  // 4. +6 to +9 items glow brightly with their own base primary color (without white sheen yet)
  for (let lvl = 6; lvl <= 9; lvl++) {
    const eff = resolveItemUpgradeColorEffect(lvl, '#0284c7', '#0c4a6e');
    assert.equal(eff.hasBrightPrimaryGlow, true, `Level +${lvl} should glow with primary color`);
    assert.equal(eff.primaryGlowColor, '#0284c7');
    assert.ok(eff.primaryGlowIntensity >= 0.6);
    assert.equal(eff.hasSubtleWhiteSheen, false, `Level +${lvl} should not have +10..+15 white sheen`);
  }

  // 5. +10 to +15 items retain bright primary glow and add a subtle white sheen
  for (let lvl = 10; lvl <= 15; lvl++) {
    const eff = resolveItemUpgradeColorEffect(lvl, '#10b981', '#0f172a');
    assert.equal(eff.isBlueDarkened, false);
    assert.equal(eff.hasBrightPrimaryGlow, true);
    assert.equal(eff.primaryGlowColor, '#10b981');
    assert.equal(eff.hasSubtleWhiteSheen, true, `Level +${lvl} should have subtle white sheen`);
    assert.ok(eff.whiteSheenAlpha >= 0.16 && eff.whiteSheenAlpha <= 0.35);
  }
});

test('Grand Reset enforces progressive level requirements (300, 305, 310...), progressive Zen costs (100k, 150k, 200k...), and reduces required level for teleporting to each city by 5 per reset', async () => {
  const {
    canEnterTerritory,
    getGrandResetRequirements,
    getTerritoryEffectiveRequiredLevel,
    performGrandReset,
    TERRITORIES,
  } = await import('./rules');

  // 1. Progressive Grand Reset requirements:
  // 1st reset (resets=0): Level 300, 100,000 Zen
  // 2nd reset (resets=1): Level 305, 150,000 Zen
  // 3rd reset (resets=2): Level 310, 200,000 Zen
  // 4th reset (resets=3): Level 315, 250,000 Zen
  const req1 = getGrandResetRequirements(0);
  assert.equal(req1.nextResetNumber, 1);
  assert.equal(req1.requiredLevel, 300);
  assert.equal(req1.zenCost, 100_000);
  assert.equal(req1.nextTerritoryLevelReduction, 5);

  const req2 = getGrandResetRequirements(1);
  assert.equal(req2.nextResetNumber, 2);
  assert.equal(req2.requiredLevel, 305);
  assert.equal(req2.zenCost, 150_000);
  assert.equal(req2.nextTerritoryLevelReduction, 10);

  const req3 = getGrandResetRequirements(2);
  assert.equal(req3.nextResetNumber, 3);
  assert.equal(req3.requiredLevel, 310);
  assert.equal(req3.zenCost, 200_000);
  assert.equal(req3.nextTerritoryLevelReduction, 15);

  const req4 = getGrandResetRequirements(3);
  assert.equal(req4.nextResetNumber, 4);
  assert.equal(req4.requiredLevel, 315);
  assert.equal(req4.zenCost, 250_000);
  assert.equal(req4.nextTerritoryLevelReduction, 20);

  // 2. Verify performGrandReset strictly validates progressive level and Zen cost at each reset step
  const baseHero = createInitialPlayerState('dark_knight');

  // Reset #1 fails at level 299 or with 99,999 Zen, succeeds at level 300 with 100,000 Zen
  assert.equal(performGrandReset({ ...baseHero, level: 299, zen: 100_000 }).success, false);
  assert.equal(performGrandReset({ ...baseHero, level: 300, zen: 99_999 }).success, false);
  const reset1 = performGrandReset({ ...baseHero, level: 300, zen: 100_000 });
  assert.equal(reset1.success, true);
  assert.equal(reset1.nextState.resets, 1);
  assert.equal(reset1.nextState.zen, 0);

  // Reset #2 fails at level 300..304 or with 149,999 Zen, succeeds at level 305 with 150,000 Zen
  assert.equal(performGrandReset({ ...reset1.nextState, level: 300, zen: 200_000 }).success, false);
  assert.equal(performGrandReset({ ...reset1.nextState, level: 304, zen: 200_000 }).success, false);
  assert.equal(performGrandReset({ ...reset1.nextState, level: 305, zen: 149_999 }).success, false);
  const reset2 = performGrandReset({ ...reset1.nextState, level: 305, zen: 175_000 });
  assert.equal(reset2.success, true);
  assert.equal(reset2.nextState.resets, 2);
  assert.equal(reset2.nextState.zen, 25_000);

  // Reset #3 fails at level 309 or with 199,999 Zen, succeeds at level 310 with 200,000 Zen
  assert.equal(performGrandReset({ ...reset2.nextState, level: 309, zen: 200_000 }).success, false);
  assert.equal(performGrandReset({ ...reset2.nextState, level: 310, zen: 199_999 }).success, false);
  const reset3 = performGrandReset({ ...reset2.nextState, level: 310, zen: 200_000 });
  assert.equal(reset3.success, true);
  assert.equal(reset3.nextState.resets, 3);
  assert.equal(reset3.nextState.zen, 0);

  // 3. Every Grand Reset reduces the required level for teleporting to each city by 5 levels (minimum level 1)
  // Noria base recommendedLevel = 12:
  // - 0 resets -> requires 12
  // - 1 reset  -> requires 7
  // - 2 resets -> requires 2
  // - 3 resets -> requires 1 (clamped at 1)
  assert.equal(getTerritoryEffectiveRequiredLevel(12, 0), 12);
  assert.equal(getTerritoryEffectiveRequiredLevel(12, 1), 7);
  assert.equal(getTerritoryEffectiveRequiredLevel(12, 2), 2);
  assert.equal(getTerritoryEffectiveRequiredLevel(12, 3), 1);

  assert.equal(canEnterTerritory(7, 'noria', 0).allowed, false);
  assert.equal(canEnterTerritory(7, 'noria', 1).allowed, true);
  assert.equal(canEnterTerritory(6, 'noria', 1).allowed, false);
  assert.equal(canEnterTerritory(2, 'noria', 2).allowed, true);
  assert.equal(canEnterTerritory(1, 'noria', 2).allowed, false);
  assert.equal(canEnterTerritory(1, 'noria', 3).allowed, true);

  // Verify every territory in TERRITORIES reduces its required level by 5 * resets (down to min 1)
  for (const territory of TERRITORIES) {
    for (const r of [0, 1, 2, 5, 10]) {
      const expectedReq = Math.max(1, territory.recommendedLevel - r * 5);
      const checkAtReq = canEnterTerritory(expectedReq, territory.id, r);
      assert.equal(checkAtReq.allowed, true, `Should allow entering ${territory.id} at level ${expectedReq} with ${r} resets`);
      assert.equal(checkAtReq.requiredLevel, expectedReq);
      assert.equal(checkAtReq.baseRequiredLevel, territory.recommendedLevel);
      if (expectedReq > 1) {
        const checkBelowReq = canEnterTerritory(expectedReq - 1, territory.id, r);
        assert.equal(checkBelowReq.allowed, false, `Should block entering ${territory.id} at level ${expectedReq - 1} with ${r} resets`);
      }
    }
  }
});

test('Every differently-named inventory item (all 39 weapons, 38 armors, 38 helms, 6 wings, rings, and pendants) resolves to its own unique iconId and reflects upgrade level + rarity glow', async () => {
  const {
    formatShortInventoryItemLabel,
    inferEquipmentClassId,
    resolveInventoryItemIconDescriptor,
  } = await import('./models');
  const { CLASSES } = await import('./rules');

  const dkWeapons = [
    'Короткий Меч Лоренсии',
    'Клинок Хаоса',
    'Клинок Изумрудной Нории',
    'Рунный Меч Эльбеланда',
    'Ледяной Клинок Девиаса',
    'Клинок Разрушения',
    'Трезубец Атланса',
    'Коса Балрога',
    'Клинок Заикана Таркана',
    'Меч Огненного Феникса',
    'Клинок Бездны Калимы',
    'Королевский Меч Лорена',
    'Божественный Меч Архангела',
  ];
  const dwWeapons = [
    'Ученический Посох Лоренсии',
    'Посох Легендарной Души',
    'Посох Древней Нории',
    'Жезл Иллюзий Эльбеланда',
    'Ледяной Посох Девиаса',
    'Посох Души Дракона',
    'Посох Вод Атланса',
    'Посох Пламени Балрога',
    'Жезл Песков Таркана',
    'Посох Небес Икаруса',
    'Жезл Оракула Калимы',
    'Скипетр Империи Кантуру',
    'Посох Архангела Кундуна',
  ];
  const elfWeapons = [
    'Короткий Лук Лоренсии',
    'Лук Серебряного Крыла',
    'Лук Королевы Нории',
    'Лук Ветров Эльбеланда',
    'Хрустальный Лук Девиаса',
    'Арбалет Святого Духа',
    'Коралловый Лук Атланса',
    'Лук Хаоса Башни',
    'Лук Золотых Песков',
    'Крылатый Лук Икаруса',
    'Арбалет Кошмара Кантуру',
    'Лук Ледяного Раклиона',
    'Божественный Арбалет Архангела',
  ];

  // 1. All 39 named weapons resolve to 39 distinct weapon iconIds even when inspected from another class's inventory
  const weaponIcons = new Set<string>();
  for (const name of [...dkWeapons, ...dwWeapons, ...elfWeapons]) {
    const desc = resolveInventoryItemIconDescriptor(
      {
        ...CLASSES.dark_knight.startingWeapon,
        name,
        slot: 'weapon',
        rarity: 'normal',
        level: 0,
      },
      'dark_knight'
    );
    assert.equal(desc.slot, 'weapon');
    assert.ok(!weaponIcons.has(desc.iconId), `Duplicate weapon iconId "${desc.iconId}" for "${name}"`);
    weaponIcons.add(desc.iconId);
  }
  assert.equal(weaponIcons.size, 39, 'All 39 named weapons must have 39 unique inventory iconIds');

  // 2. All 38 named armors resolve to 38 distinct armor iconIds (including Fairy Elf armors with "Одеяние")
  const dkArmors = [
    'Кожаный Доспех Лоренсии',
    'Кираса Чёрного Дракона',
    'Броня Стража Нории',
    'Доспех Рыцаря Эльбеланда',
    'Латы Северного Девиаса',
    'Латы Чёрного Феникса',
    'Чешуйчатый Доспех Атланса',
    'Броня Повелителя Башни',
    'Латы Пустынного Титана',
    'Доспех Небесного Дракона',
    'Броня Императора Кантуру',
    'Кираса Вечного Льда',
    'Доспех Великого Титана',
  ];
  const dwArmors = [
    'Холщовая Мантия Лоренсии',
    'Мантия Анубиса',
    'Мантия Мудреца Нории',
    'Роба Туманов Эльбеланда',
    'Мантия Вьюги Девиаса',
    'Мантия Легендарного Духа',
    'Одеяние Бездны Атланса',
    'Мантия Затмения Башни',
    'Мантия Бури Таркана',
    'Одеяние Звёздного Икаруса',
    'Роба Реликвий Кантуру',
    'Мантия Пентаграмм Ахерона',
    'Мантия Вечности Кундуна',
  ];
  const elfArmors = [
    'Лёгкая Туника Лоренсии',
    'Доспех Стража Нории',
    'Туника Луны Эльбеланда',
    'Одеяние Снегов Девиаса',
    'Одеяние Красного Духа',
    'Латы Сирены Атланса',
    'Доспех Валькирии Башни',
    'Одеяние Оазиса Таркана',
    'Крылатый Доспех Икаруса',
    'Броня Стража Крайвульфа',
    'Латы Хрустальной Никси',
    'Божественные Латы Сильфиды',
  ];

  assert.equal(
    inferEquipmentClassId({ ...CLASSES.fairy_elf.startingArmor, name: 'Одеяние Снегов Девиаса', slot: 'armor' }, 'dark_wizard'),
    'fairy_elf'
  );
  assert.equal(
    inferEquipmentClassId({ ...CLASSES.fairy_elf.startingArmor, name: 'Одеяние Красного Духа', slot: 'armor' }, 'dark_wizard'),
    'fairy_elf'
  );
  assert.equal(
    inferEquipmentClassId({ ...CLASSES.fairy_elf.startingArmor, name: 'Одеяние Оазиса Таркана', slot: 'armor' }, 'dark_wizard'),
    'fairy_elf'
  );

  const armorIcons = new Set<string>();
  for (const name of [...dkArmors, ...dwArmors, ...elfArmors]) {
    const desc = resolveInventoryItemIconDescriptor(
      {
        ...CLASSES.dark_knight.startingArmor,
        name,
        slot: 'armor',
        rarity: 'normal',
        level: 0,
      },
      'dark_knight'
    );
    assert.equal(desc.slot, 'armor');
    assert.ok(!armorIcons.has(desc.iconId), `Duplicate armor iconId "${desc.iconId}" for "${name}"`);
    armorIcons.add(desc.iconId);
  }
  assert.equal(armorIcons.size, 38, 'All 38 named armors must have 38 unique inventory iconIds');

  // 3. All 38 named helms resolve to 38 distinct helm iconIds (including Fairy Elf helms with "Венец")
  const dkHelms = [
    'Кожаный Шлем Лоренсии',
    'Шлем Чёрного Дракона',
    'Шлем Стража Нории',
    'Корона Эльбеланда',
    'Шлем Льдов Девиаса',
    'Шлем Чёрного Феникса',
    'Шлем Глубин Атланса',
    'Рогатый Шлем Балрога',
    'Шлем Песчаной Бури',
    'Корона Небесного Феникса',
    'Шлем Титана Кантуру',
    'Корона Фереи',
    'Корона Великого Титана',
  ];
  const dwHelms = [
    'Повязка Ученика Лоренсии',
    'Венец Анубиса',
    'Венец Нории',
    'Диадема Эльбеланда',
    'Корона Стужи Девиаса',
    'Венец Легендарного Духа',
    'Тиара Атланса',
    'Корона Затмения',
    'Венец Оракула Таркана',
    'Диадема Икаруса',
    'Венец Кошмара Кантуру',
    'Корона Ахерона',
    'Корона Вечности',
  ];
  const elfHelms = [
    'Обруч Рощи Лоренсии',
    'Диадема Стража Нории',
    'Тиара Эльбеланда',
    'Венец Льдов Девиаса',
    'Тиара Красного Духа',
    'Корона Сирены Атланса',
    'Диадема Валькирии',
    'Тиара Песков Таркана',
    'Венец Облаков Икаруса',
    'Корона Алтаря Волка',
    'Диадема Озера Никси',
    'Корона Сильфиды',
  ];

  assert.equal(
    inferEquipmentClassId({ ...CLASSES.fairy_elf.startingHelm, name: 'Венец Льдов Девиаса', slot: 'helm' }, 'dark_wizard'),
    'fairy_elf'
  );
  assert.equal(
    inferEquipmentClassId({ ...CLASSES.fairy_elf.startingHelm, name: 'Венец Облаков Икаруса', slot: 'helm' }, 'dark_wizard'),
    'fairy_elf'
  );

  const helmIcons = new Set<string>();
  for (const name of [...dkHelms, ...dwHelms, ...elfHelms]) {
    const desc = resolveInventoryItemIconDescriptor(
      {
        ...CLASSES.dark_knight.startingHelm,
        name,
        slot: 'helm',
        rarity: 'normal',
        level: 0,
      },
      'dark_knight'
    );
    assert.equal(desc.slot, 'helm');
    assert.ok(!helmIcons.has(desc.iconId), `Duplicate helm iconId "${desc.iconId}" for "${name}"`);
    helmIcons.add(desc.iconId);
  }
  assert.equal(helmIcons.size, 38, 'All 38 named helms must have 38 unique inventory iconIds');

  // 4. All 6 named wings resolve to 6 distinct wing iconIds and carry upgrade & rarity effects
  const wingNames = [
    'Крылья Сатаны II',
    'Крылья Небес II',
    'Крылья Эльфа II',
    'Крылья Шторма III',
    'Крылья Вечности III',
    'Крылья Иллюзии III',
  ];
  const wingIcons = new Set<string>();
  for (const name of wingNames) {
    const desc = resolveInventoryItemIconDescriptor(
      {
        ...CLASSES.dark_knight.startingArmor,
        name,
        slot: 'wings',
        rarity: 'ancient',
        level: 12,
      },
      'dark_knight'
    );
    assert.equal(desc.slot, 'wings');
    assert.equal(desc.hasAncientPurpleGlow, true);
    assert.equal(desc.upgradeEffect.hasBrightPrimaryGlow, true);
    assert.equal(desc.upgradeEffect.hasSubtleWhiteSheen, true);
    wingIcons.add(desc.iconId);
  }
  assert.equal(wingIcons.size, 6, 'All 6 named wings must have 6 unique inventory iconIds');

  // 5. Short label formatter strips rarity prefixes while preserving the distinctive item name
  assert.equal(formatShortInventoryItemLabel('Экселлент Меч Черного Дракона'), 'Меч Черного Дракона');
  assert.equal(formatShortInventoryItemLabel('Древний Корона Кундуна'), 'Корона Кундуна');
});

test('Wings can ONLY be upgraded at the Chaos Machine for 1 Bless + 1 Soul + 1 Chaos (up to +9) and 3 Bless + 3 Soul + 3 Chaos (for +10..+15), and never via single jewels or re-crafting', async () => {
  const {
    craftChaosWings,
    getWingChaosUpgradeCost,
    unequipItemToInventory,
    upgradeItemWithJewel,
    upgradeWingsInChaosMachine,
  } = await import('./rules');

  // 1. Verify cost table across all levels +0 -> +15
  for (let currentLvl = 0; currentLvl <= 8; currentLvl++) {
    const cost = getWingChaosUpgradeCost(currentLvl);
    assert.equal(cost.nextLevel, currentLvl + 1);
    assert.equal(cost.isHighTier, false, `Target +${cost.nextLevel} should be 1B+1S+1C tier`);
    assert.equal(cost.bless, 1);
    assert.equal(cost.soul, 1);
    assert.equal(cost.chaos, 1);
  }
  for (let currentLvl = 9; currentLvl <= 14; currentLvl++) {
    const cost = getWingChaosUpgradeCost(currentLvl);
    assert.equal(cost.nextLevel, currentLvl + 1);
    assert.equal(cost.isHighTier, true, `Target +${cost.nextLevel} (+10 and above) should be 3B+3S+3C tier`);
    assert.equal(cost.bless, 3);
    assert.equal(cost.soul, 3);
    assert.equal(cost.chaos, 3);
  }
  assert.equal(getWingChaosUpgradeCost(15).isMaxLevel, true);

  // 2. Crafting Tier 2 wings starts at +0 (not +2!)
  const baseHero = {
    ...createInitialPlayerState('dark_knight'),
    zen: 50_000,
    jewels: { bless: 50, soul: 50, life: 50, chaos: 50 },
  };
  const craftedT2 = craftChaosWings(baseHero);
  assert.equal(craftedT2.success, true);
  assert.equal(craftedT2.nextState.equipped.wings?.level, 0);
  const wingId = craftedT2.nextState.equipped.wings!.id;

  // 3. Single-jewel upgrades (Bless, Soul, Life) on wings MUST fail and leave wing level/options and jewels untouched
  for (const jewelType of ['bless', 'soul', 'life'] as const) {
    const res = upgradeItemWithJewel(craftedT2.nextState, wingId, jewelType, 0.01);
    assert.equal(res.success, false, `Single jewel ${jewelType} must NOT upgrade wings`);
    assert.equal(res.nextState.equipped.wings?.level, 0);
    assert.deepEqual(res.nextState.jewels, craftedT2.nextState.jewels);
  }

  // Also test when wings are unequipped in the inventory bag
  const unequipped = unequipItemToInventory(craftedT2.nextState, 'wings');
  assert.equal(unequipped.success, true);
  for (const jewelType of ['bless', 'soul', 'life'] as const) {
    const resBag = upgradeItemWithJewel(unequipped.nextState, wingId, jewelType, 0.01);
    assert.equal(resBag.success, false, `Single jewel ${jewelType} must NOT upgrade wings in inventory`);
  }

  // 4. Upgrading wings in Chaos Machine from +0 to +9 costs 1 Bless + 1 Soul + 1 Chaos per level
  let state = craftedT2.nextState;
  for (let targetLvl = 1; targetLvl <= 9; targetLvl++) {
    const beforeJewels = { ...state.jewels };
    const upgRes = upgradeWingsInChaosMachine(state);
    assert.equal(upgRes.success, true, `Should upgrade wings to +${targetLvl}`);
    assert.equal(upgRes.nextState.equipped.wings?.level, targetLvl);
    assert.equal(upgRes.nextState.jewels.bless, beforeJewels.bless - 1);
    assert.equal(upgRes.nextState.jewels.soul, beforeJewels.soul - 1);
    assert.equal(upgRes.nextState.jewels.chaos, beforeJewels.chaos - 1);
    state = upgRes.nextState;
  }
  assert.equal(state.equipped.wings?.level, 9);

  // 5. Evolving Tier 2 (+9) wings into Tier 3 wings preserves +9 level (does NOT add +2!) and blocks re-crafting Tier 3
  const evolvedT3 = craftChaosWings(state);
  assert.equal(evolvedT3.success, true);
  assert.equal(evolvedT3.nextState.equipped.wings?.rarity, 'ancient');
  assert.equal(evolvedT3.nextState.equipped.wings?.level, 9);
  state = evolvedT3.nextState;

  const recraftT3 = craftChaosWings(state);
  assert.equal(recraftT3.success, false, 'Cannot re-craft Tier 3 wings');

  // 6. Upgrading from +9 to +10 ("на +10 и выше") fails if player only has 2 of any required jewel
  const insufficientFor10 = upgradeWingsInChaosMachine({
    ...state,
    jewels: { bless: 3, soul: 2, chaos: 3, life: 5 },
  });
  assert.equal(insufficientFor10.success, false, 'Upgrading to +10 must fail with only 2 Souls');

  // 7. Upgrading from +9 through +15 ("на +10 и выше") costs 3 Bless + 3 Soul + 3 Chaos per level
  for (let targetLvl = 10; targetLvl <= 15; targetLvl++) {
    const beforeJewels = { ...state.jewels };
    const upgRes = upgradeWingsInChaosMachine(state);
    assert.equal(upgRes.success, true, `Should upgrade wings to +${targetLvl}`);
    assert.equal(upgRes.nextState.equipped.wings?.level, targetLvl);
    assert.equal(upgRes.nextState.jewels.bless, beforeJewels.bless - 3);
    assert.equal(upgRes.nextState.jewels.soul, beforeJewels.soul - 3);
    assert.equal(upgRes.nextState.jewels.chaos, beforeJewels.chaos - 3);
    state = upgRes.nextState;
  }
  assert.equal(state.equipped.wings?.level, 15);

  // 8. At +15 max level, further upgrades are rejected
  const beyond15 = upgradeWingsInChaosMachine(state);
  assert.equal(beyond15.success, false);
});





