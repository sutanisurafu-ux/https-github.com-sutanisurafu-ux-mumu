import React, { useState } from 'react';
import {
  formatShortInventoryItemLabel,
} from '../game/models';
import {
  calculateDerivedStats,
  calculateItemEffectiveAttack,
  calculateItemEffectiveDefense,
  getFirstProfQuestItemName,
} from '../game/rules';
import {
  EquipmentItem,
  ItemRarity,
  ItemSlot,
  PlayerProgressState,
} from '../game/types';
import { HeroModelPreview } from './HeroModelPreview';
import {
  CrossModalDragPayload,
  HoverTooltipState,
  ItemHoverTooltip,
} from './ItemHoverTooltip';
import {
  EquipmentItemIcon,
  SpecialInventoryIcon,
} from './ItemIcon';

interface CharacterInventoryModalProps {
  player: PlayerProgressState;
  isNearShop: boolean;
  shopOpen: boolean;
  activeDragPayload: CrossModalDragPayload | null;
  onSetDragPayload: (payload: CrossModalDragPayload | null) => void;
  onOpenShop: () => void;
  onClose: () => void;
  onEquipItem: (item: EquipmentItem) => string;
  onUnequipSlot: (slot: ItemSlot) => string;
  onSellItem: (item: EquipmentItem) => void;
  onDropInventoryItem: (item: EquipmentItem) => string;
  onDropEquippedSlot: (slot: ItemSlot) => string;
  onUpgradeWithJewel: (itemId: string, jewel: 'bless' | 'soul' | 'life') => string;
  onBuyPotions: (potionType: 'hp' | 'large_hp' | 'mp', packSize: 5 | 20) => string;
  onBuySkillBook: (skillId: string) => string;
  onBuyShopEquipment: (catalogId: string) => string;
}

type ActiveJewelCursor = 'bless' | 'soul' | 'life' | null;

type SelectedInspectorTarget =
  | { kind: 'equipped'; slot: ItemSlot }
  | { kind: 'inventory'; itemId: string }
  | { kind: 'jewel'; jewel: 'bless' | 'soul' | 'life' | 'chaos' }
  | { kind: 'quest_item' }
  | null;

const TOTAL_GRID_CELLS = 32; // Classic 8x4 MU Inventory Grid

const SLOT_LABELS: Record<ItemSlot, string> = {
  helm: 'Шлем',
  wings: 'Крылья',
  weapon: 'Оружие',
  armor: 'Доспех',
  ring: 'Кольцо',
  pendant: 'Амулет',
};

function getRarityBorderClass(rarity?: ItemRarity): string {
  if (rarity === 'ancient') {
    return 'border-purple-400/90 bg-gradient-to-br from-purple-500/25 via-purple-900/20 to-[#14111d] shadow-[0_0_15px_rgba(192,132,252,0.42),inset_0_0_12px_rgba(192,132,252,0.28)]';
  }
  if (rarity === 'excellent') {
    return 'border-emerald-400/90 bg-gradient-to-br from-emerald-500/25 via-emerald-900/20 to-[#14111d] shadow-[0_0_15px_rgba(52,211,153,0.42),inset_0_0_12px_rgba(52,211,153,0.28)]';
  }
  if (rarity === 'magic') {
    return 'border-sky-400/75 bg-gradient-to-br from-sky-500/20 to-[#14111d]';
  }
  return 'border-white/20 bg-[#171321]';
}

function getRarityTextClass(rarity?: ItemRarity): string {
  if (rarity === 'ancient') return 'text-purple-300 drop-shadow-[0_0_6px_rgba(192,132,252,0.55)]';
  if (rarity === 'excellent') return 'text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.55)]';
  if (rarity === 'magic') return 'text-sky-300';
  return 'text-[#f3efe6]';
}

export const CharacterInventoryModal: React.FC<CharacterInventoryModalProps> = ({
  player,
  isNearShop,
  shopOpen,
  activeDragPayload,
  onSetDragPayload,
  onOpenShop,
  onClose,
  onEquipItem,
  onUnequipSlot,
  onSellItem,
  onDropInventoryItem,
  onDropEquippedSlot,
  onUpgradeWithJewel,
  onBuyPotions,
  onBuySkillBook,
  onBuyShopEquipment,
}) => {
  const [statusBanner, setStatusBanner] = useState<string | null>(
    'Наведите мышь на вещь для подсказки. В Лавке Ханзо: Ctrl + ЛКМ или перетаскивание в окно Лавки — продать! За пределы окна — выбросить.'
  );
  const [activeJewelCursor, setActiveJewelCursor] = useState<ActiveJewelCursor>(null);
  const [selectedTarget, setSelectedTarget] = useState<SelectedInspectorTarget>({
    kind: 'equipped',
    slot: 'weapon',
  });
  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltipState | null>(null);
  const [dropZoneHover, setDropZoneHover] = useState(false);

  const derived = calculateDerivedStats(player);
  const questItemName = getFirstProfQuestItemName(player.classId);

  const isDraggingFromShop =
    activeDragPayload?.source === 'shop_equipment' ||
    activeDragPayload?.source === 'shop_skill_book' ||
    activeDragPayload?.source === 'shop_potion';

  const isDraggingDroppableItem =
    activeDragPayload?.source === 'inventory' ||
    activeDragPayload?.source === 'equipped';

  // Build the 32 cells of the 8x4 Inventory Grid:
  type GridCellContent =
    | {
        type: 'jewel_stack';
        jewel: 'bless' | 'soul' | 'life' | 'chaos';
        count: number;
        label: string;
        desc: string;
      }
    | { type: 'potion_hp_stack'; count: number }
    | { type: 'potion_large_hp_stack'; count: number }
    | { type: 'potion_mp_stack'; count: number }
    | { type: 'quest_item_cell'; hasItem: boolean; name: string }
    | { type: 'equipment'; item: EquipmentItem }
    | { type: 'empty' };

  const gridCells: GridCellContent[] = [];

  gridCells.push({
    type: 'jewel_stack',
    jewel: 'bless',
    count: player.jewels.bless,
    label: 'Jewel of Bless',
    desc: '100% заточка предмета с +0 до +6. Кликните или перетащите мышкой на экипировку!',
  });
  gridCells.push({
    type: 'jewel_stack',
    jewel: 'soul',
    count: player.jewels.soul,
    label: 'Jewel of Soul',
    desc: 'Заточка предмета с +7 до +15 (80% шанс). Перетащите мышкой на экипировку!',
  });
  gridCells.push({
    type: 'jewel_stack',
    jewel: 'life',
    count: player.jewels.life,
    label: 'Jewel of Life',
    desc: 'Добавляет +4..+28 доп. опцию АТК/ЗАЩ. Перетащите мышкой на любую вещь!',
  });
  gridCells.push({
    type: 'jewel_stack',
    jewel: 'chaos',
    count: player.jewels.chaos,
    label: 'Jewel of Chaos',
    desc: 'Древний кристалл для синтеза Крыльев 2-го и 3-го уровня в Машине Хаоса [K].',
  });
  gridCells.push({
    type: 'potion_hp_stack',
    count: player.hpPotions,
  });
  gridCells.push({
    type: 'potion_large_hp_stack',
    count: player.largeHpPotions ?? 0,
  });
  gridCells.push({
    type: 'potion_mp_stack',
    count: player.mpPotions,
  });
  gridCells.push({
    type: 'quest_item_cell',
    hasItem: player.hasFirstProfQuestItem,
    name: questItemName,
  });

  for (const item of player.inventory) {
    if (gridCells.length < TOTAL_GRID_CELLS) {
      gridCells.push({ type: 'equipment', item });
    }
  }

  while (gridCells.length < TOTAL_GRID_CELLS) {
    gridCells.push({ type: 'empty' });
  }

  const beginDrag = (payload: CrossModalDragPayload, e: React.DragEvent) => {
    setHoverTooltip(null);
    onSetDragPayload(payload);
    try {
      e.dataTransfer.setData('text/plain', JSON.stringify(payload));
      e.dataTransfer.effectAllowed = 'copyMove';
    } catch {
      // Fallback handled by shared activeDragPayload state
    }
  };

  const resolveDragPayload = (e: React.DragEvent): CrossModalDragPayload | null => {
    if (activeDragPayload) return activeDragPayload;
    try {
      const raw = e.dataTransfer.getData('text/plain');
      if (raw) return JSON.parse(raw) as CrossModalDragPayload;
    } catch {
      return null;
    }
    return null;
  };

  const handleApplyJewelToItem = (itemId: string, jewel: 'bless' | 'soul' | 'life') => {
    const msg = onUpgradeWithJewel(itemId, jewel);
    setStatusBanner(msg);
    setActiveJewelCursor(null);
  };

  const handleEquippedSlotClick = (slot: ItemSlot) => {
    const equippedItem = player.equipped[slot];
    if (activeJewelCursor && equippedItem) {
      handleApplyJewelToItem(equippedItem.id, activeJewelCursor);
      return;
    }
    setSelectedTarget({ kind: 'equipped', slot });
  };

  const handleEquippedSlotUnequip = (slot: ItemSlot, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const msg = onUnequipSlot(slot);
    setStatusBanner(msg);
  };

  const handleInventoryItemClick = (item: EquipmentItem, e?: React.MouseEvent) => {
    if (e && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();
      if (shopOpen || isNearShop) {
        onSellItem(item);
        setHoverTooltip(null);
        setSelectedTarget(null);
        setStatusBanner(
          `💰 Продано торговцу Ханзо (Ctrl + ЛКМ): ${item.name} за +${item.valueZen} Zen!`
        );
      } else {
        setStatusBanner(
          '🔒 Для быстрой продажи (Ctrl + ЛКМ) подойдите к Лавке Ханзо в городе!'
        );
      }
      return;
    }
    if (activeJewelCursor) {
      handleApplyJewelToItem(item.id, activeJewelCursor);
      return;
    }
    setSelectedTarget({ kind: 'inventory', itemId: item.id });
  };

  const handleInventoryItemEquip = (item: EquipmentItem, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const msg = onEquipItem(item);
    setStatusBanner(msg);
    setSelectedTarget({ kind: 'equipped', slot: item.slot });
  };

  const executeShopPurchaseDrop = (payload: CrossModalDragPayload): boolean => {
    if (payload.source === 'shop_equipment') {
      const msg = onBuyShopEquipment(payload.catalogId);
      setStatusBanner(msg);
      return true;
    }
    if (payload.source === 'shop_skill_book') {
      const msg = onBuySkillBook(payload.skillId);
      setStatusBanner(msg);
      return true;
    }
    if (payload.source === 'shop_potion') {
      const msg = onBuyPotions(payload.potionType, payload.packSize);
      setStatusBanner(msg);
      return true;
    }
    return false;
  };

  const handleDropOnPaperdollSlot = (targetSlot: ItemSlot, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const payload = resolveDragPayload(e);
    if (!payload) return;

    if (executeShopPurchaseDrop(payload)) {
      onSetDragPayload(null);
      return;
    }

    if (payload.source === 'inventory') {
      const item = player.inventory.find((i) => i.id === payload.itemId);
      if (!item) return;
      if (item.slot !== targetSlot) {
        setStatusBanner(
          `Предмет «${item.name}» предназначен для слота «${SLOT_LABELS[item.slot]}»!`
        );
        onSetDragPayload(null);
        return;
      }
      handleInventoryItemEquip(item);
    } else if (payload.source === 'jewel') {
      const targetItem = player.equipped[targetSlot];
      if (targetItem) {
        handleApplyJewelToItem(targetItem.id, payload.jewel);
      } else {
        setStatusBanner('В этом слоте нет предмета для улучшения камнем.');
      }
    }
    onSetDragPayload(null);
  };

  const handleDropOnHeroPreview = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const payload = resolveDragPayload(e);
    if (!payload) return;

    if (executeShopPurchaseDrop(payload)) {
      onSetDragPayload(null);
      return;
    }

    if (payload.source === 'inventory') {
      const item = player.inventory.find((i) => i.id === payload.itemId);
      if (item) {
        handleInventoryItemEquip(item);
      }
    }
    onSetDragPayload(null);
  };

  const handleDropOnGridCell = (cell: GridCellContent, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const payload = resolveDragPayload(e);
    if (!payload) return;

    if (executeShopPurchaseDrop(payload)) {
      onSetDragPayload(null);
      return;
    }

    if (payload.source === 'equipped') {
      handleEquippedSlotUnequip(payload.slot);
    } else if (payload.source === 'jewel' && cell.type === 'equipment') {
      handleApplyJewelToItem(cell.item.id, payload.jewel);
    }
    onSetDragPayload(null);
  };

  const handleDropOnGridContainer = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const payload = resolveDragPayload(e);
    if (!payload) return;
    if (executeShopPurchaseDrop(payload)) {
      onSetDragPayload(null);
    }
  };

  const handleDropOnGroundZone = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropZoneHover(false);
    const payload = resolveDragPayload(e);
    if (!payload) return;
    if (payload.source === 'inventory') {
      const item = player.inventory.find((i) => i.id === payload.itemId);
      if (item) {
        const msg = onDropInventoryItem(item);
        setStatusBanner(msg);
        setSelectedTarget(null);
      }
    } else if (payload.source === 'equipped') {
      const msg = onDropEquippedSlot(payload.slot);
      setStatusBanner(msg);
      setSelectedTarget(null);
    }
    onSetDragPayload(null);
  };

  const updateTooltipCoords = (e: React.MouseEvent) => {
    setHoverTooltip((prev) =>
      prev ? { ...prev, clientX: e.clientX, clientY: e.clientY } : null
    );
  };

  const renderPaperdollSlot = (slot: ItemSlot) => {
    const item = player.equipped[slot];
    const isSelected =
      selectedTarget?.kind === 'equipped' && selectedTarget.slot === slot;

    return (
      <div
        key={slot}
        draggable={item !== null}
        onDragStart={(e) => {
          if (item) beginDrag({ source: 'equipped', slot }, e);
        }}
        onDragEnd={() => onSetDragPayload(null)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleDropOnPaperdollSlot(slot, e)}
        onMouseEnter={(e) => {
          if (item) {
            setSelectedTarget({ kind: 'equipped', slot });
            setHoverTooltip({
              target: {
                kind: 'equipment',
                item,
                context: 'equipped',
              },
              clientX: e.clientX,
              clientY: e.clientY,
            });
          }
        }}
        onMouseMove={updateTooltipCoords}
        onMouseLeave={() => setHoverTooltip(null)}
        onClick={() => handleEquippedSlotClick(slot)}
        onDoubleClick={(e) => {
          if (item) handleEquippedSlotUnequip(slot, e);
        }}
        onContextMenu={(e) => {
          if (item) handleEquippedSlotUnequip(slot, e);
        }}
        role="button"
        tabIndex={0}
        aria-label={`Слот экипировки ${SLOT_LABELS[slot]}: ${item ? `${item.name} +${item.level}` : 'Пусто'}`}
        className={`group relative flex h-[74px] w-full flex-col justify-between rounded-xl border p-2 transition-colors cursor-pointer ${
          item ? getRarityBorderClass(item.rarity) : 'border-amber-500/25 bg-[#120f1a]/90'
        } ${isSelected ? 'ring-2 ring-amber-400' : 'hover:border-amber-400/70'}`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#b5ab9b]">
            {SLOT_LABELS[slot]}
          </span>
          {item && (
            <span className="rounded bg-black/75 px-1.5 py-0.5 font-mono-num text-[10px] font-extrabold text-amber-300">
              +{item.level}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <div className="shrink-0 opacity-95">
            <EquipmentItemIcon
              slot={slot}
              rarity={item?.rarity}
              item={item}
              fallbackClassId={player.classId}
              className="h-7 w-7"
            />
          </div>
          {item ? (
            <div className="min-w-0 flex-1">
              <div className={`truncate text-[11px] font-bold ${getRarityTextClass(item.rarity)}`}>
                {item.name}
              </div>
              <div className="font-mono-num text-[10px] text-[#cfc6b8]">
                {item.baseAttack > 0 && `АТК ${calculateItemEffectiveAttack(item)} `}
                {item.baseDefense > 0 && `ЗАЩ ${calculateItemEffectiveDefense(item)}`}
              </div>
            </div>
          ) : (
            <span className="text-[10px] italic text-[#6e665a]">Пусто</span>
          )}
        </div>

        {item && (
          <button
            type="button"
            onClick={(e) => handleEquippedSlotUnequip(slot, e)}
            aria-label={`Снять ${item.name}`}
            title="Снять в инвентарь"
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-amber-400/80 bg-[#1f182b] text-[10px] font-bold text-amber-200 opacity-90 hover:bg-rose-600 hover:text-white cursor-pointer"
          >
            ×
          </button>
        )}
      </div>
    );
  };

  const inspectedEquipment: { item: EquipmentItem; isEquipped: boolean; slot: ItemSlot } | null =
    selectedTarget?.kind === 'equipped'
      ? player.equipped[selectedTarget.slot]
        ? {
            item: player.equipped[selectedTarget.slot]!,
            isEquipped: true,
            slot: selectedTarget.slot,
          }
        : null
      : selectedTarget?.kind === 'inventory'
        ? (() => {
            const found = player.inventory.find((i) => i.id === selectedTarget.itemId);
            return found ? { item: found, isEquipped: false, slot: found.slot } : null;
          })()
        : null;

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className="pointer-events-auto fixed right-2.5 top-16 z-40 flex max-h-[82vh] w-[calc(100vw-20px)] max-w-[530px] flex-col overflow-hidden rounded-2xl border border-amber-500/40 bg-[#110e19]/95 shadow-[0_16px_48px_rgba(0,0,0,0.92)] sm:right-5 sm:top-20"
        role="dialog"
        aria-modal="false"
        aria-label="Сетка Инвентаря и Экипировка [V]"
      >
        {/* Compact Modal Header */}
        <div className="flex items-center justify-between border-b border-amber-500/25 bg-[#171222] px-3.5 py-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-amber-400/50 bg-amber-500/20 px-1.5 py-0.5 font-mono-num text-[10px] font-extrabold text-amber-300">
                [V] ИНВЕНТАРЬ
              </span>
              <h2 className="truncate font-display text-sm font-bold text-[#fdf8ed] sm:text-base">
                Экипировка и Сумка · {player.zen} Zen
              </h2>
            </div>
            <p className="mt-0.5 font-mono-num text-[11px] text-[#bfb5a4]">
              АТК {derived.minDamage}–{derived.maxDamage} · ЗАЩ {derived.defense} · ОЗ🧪{player.hpPotions} · Б.ОЗ🍷{player.largeHpPotions ?? 0} · МН💧{player.mpPotions} · 📜Scroll {player.bloodScrolls} · 🦷Fang {player.bloodFangs} · 🎟️Билет BC {player.bloodCastleTickets}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно инвентаря [V]"
            className="gothic-button min-h-[36px] min-w-[36px] rounded-xl px-2.5 py-1 text-xs font-bold text-amber-200 cursor-pointer"
          >
            ✕ [V]
          </button>
        </div>

        {/* Interactive Status / Instruction Banner */}
        {statusBanner && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/25 bg-[#1b1526] px-3.5 py-1.5 text-[11px] font-medium text-amber-200">
            <span>{statusBanner}</span>
            {activeJewelCursor && (
              <button
                type="button"
                onClick={() => setActiveJewelCursor(null)}
                className="rounded-lg border border-rose-400 bg-rose-500/25 px-2 py-0.5 text-[10px] font-bold text-rose-200 cursor-pointer"
              >
                Отменить ({activeJewelCursor.toUpperCase()})
              </button>
            )}
          </div>
        )}

        {/* Compact Scrollable Single-Column Modal Body */}
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3.5">
          {/* PAPERDOLL EQUIPMENT PANEL (6 Slots surrounding Live 2.5D Hero Model) */}
          <div className="rounded-xl border border-amber-500/25 bg-[#14111d] p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-amber-300">
                Кукла Персонажа (Наведите мышь для статов · ПКМ или перетаскивание — снять/надеть)
              </h3>
              <span className="font-mono-num text-[11px] text-emerald-300">
                Бонус сета:{' '}
                {derived.activeSetPieceCount >= 3
                  ? '+18% АТК · +20% Двойной урон'
                  : `${derived.activeSetPieceCount}/3 предметов`}
              </span>
            </div>

            <div className="grid grid-cols-1 items-center gap-2.5 sm:grid-cols-12">
              {/* Left Paperdoll Column: Helm, Weapon, Ring */}
              <div className="flex flex-col gap-2 sm:col-span-4">
                {renderPaperdollSlot('helm')}
                {renderPaperdollSlot('weapon')}
                {renderPaperdollSlot('ring')}
              </div>

              {/* Center 2.5D Hero Model Drop Target */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDropOnHeroPreview}
                className="flex flex-col items-center justify-center sm:col-span-4"
              >
                <HeroModelPreview player={player} width={144} height={152} scale={1.36} />
                <span className="mt-1 text-[10px] font-medium text-[#b5ab9b]">
                  Перетащите вещь на героя
                </span>
              </div>

              {/* Right Paperdoll Column: Wings, Armor, Pendant */}
              <div className="flex flex-col gap-2 sm:col-span-4">
                {renderPaperdollSlot('wings')}
                {renderPaperdollSlot('armor')}
                {renderPaperdollSlot('pendant')}
              </div>
            </div>
          </div>

          {/* 32-CELL (8x4) INVENTORY GRID WITH HOVER TOOLTIP & SHOP DROP ZONE */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropOnGridContainer}
            data-testid="inventory-grid-dropzone"
            className={`rounded-xl border p-3 transition-colors ${
              isDraggingFromShop
                ? 'border-2 border-amber-300 bg-amber-500/15 shadow-[0_0_24px_rgba(251,191,36,0.3)]'
                : 'border-amber-500/25 bg-[#13101c]'
            }`}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-amber-300">
                {isDraggingFromShop
                  ? '⬇ Бросьте вещь или книгу скила из Лавки сюда, чтобы купить в инвентарь!'
                  : 'Сетка Инвентаря (32 ячейки · Наведите мышь на предмет для окна характеристик)'}
              </h3>
              <span className="text-[11px] text-[#b5ab9b]">
                {shopOpen || isNearShop
                  ? 'Ctrl+ЛКМ — продать · ПКМ — надеть'
                  : 'Двойной клик / ПКМ — надеть'}
              </span>
            </div>

            <div
              className="grid grid-cols-4 gap-1.5 sm:grid-cols-8"
              role="grid"
              aria-label="Сетка ячеек инвентаря"
            >
              {gridCells.map((cell, idx) => {
                if (cell.type === 'jewel_stack') {
                  const isCursorActive = activeJewelCursor === cell.jewel;
                  const isSelected =
                    selectedTarget?.kind === 'jewel' && selectedTarget.jewel === cell.jewel;
                  const canSocket = cell.jewel !== 'chaos' && cell.count > 0;

                  return (
                    <div
                      key={`jewel_${cell.jewel}`}
                      draggable={canSocket}
                      onDragStart={(e) => {
                        if (cell.jewel !== 'chaos' && cell.count > 0) {
                          beginDrag({ source: 'jewel', jewel: cell.jewel }, e);
                        }
                      }}
                      onDragEnd={() => onSetDragPayload(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDropOnGridCell(cell, e)}
                      onMouseEnter={(e) => {
                        setSelectedTarget({ kind: 'jewel', jewel: cell.jewel });
                        setHoverTooltip({
                          target: {
                            kind: 'jewel',
                            jewel: cell.jewel,
                            label: cell.label,
                            count: cell.count,
                            desc: cell.desc,
                          },
                          clientX: e.clientX,
                          clientY: e.clientY,
                        });
                      }}
                      onMouseMove={updateTooltipCoords}
                      onMouseLeave={() => setHoverTooltip(null)}
                      onClick={() => {
                        setSelectedTarget({ kind: 'jewel', jewel: cell.jewel });
                        if (cell.jewel !== 'chaos' && cell.count > 0) {
                          setActiveJewelCursor((prev) =>
                            prev === cell.jewel ? null : (cell.jewel as ActiveJewelCursor)
                          );
                        }
                      }}
                      role="gridcell"
                      tabIndex={0}
                      aria-label={`Стак камней ${cell.label}: ${cell.count} шт.`}
                      className={`relative flex h-14 flex-col items-center justify-center rounded-lg border p-1 cursor-pointer select-none ${
                        isCursorActive
                          ? 'border-amber-300 bg-amber-500/25 ring-2 ring-amber-400'
                          : isSelected
                            ? 'border-amber-400 bg-[#221b30]'
                            : 'border-purple-400/35 bg-[#191426] hover:border-amber-400/70'
                      }`}
                    >
                      <SpecialInventoryIcon kind={cell.jewel} className="h-7 w-7" />
                      <span className="mt-0.5 max-w-full truncate text-[9px] font-bold text-amber-200">
                        {cell.jewel.toUpperCase()}
                      </span>
                      <span className="absolute right-1 top-1 rounded bg-black/80 px-1 font-mono-num text-[10px] font-extrabold text-amber-300">
                        ×{cell.count}
                      </span>
                    </div>
                  );
                }

                if (cell.type === 'potion_hp_stack') {
                  return (
                    <div
                      key="potion_hp_stack"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDropOnGridCell(cell, e)}
                      onMouseEnter={(e) =>
                        setHoverTooltip({
                          target: {
                            kind: 'potion',
                            potionType: 'hp',
                            count: cell.count,
                            context: 'inventory',
                          },
                          clientX: e.clientX,
                          clientY: e.clientY,
                        })
                      }
                      onMouseMove={updateTooltipCoords}
                      onMouseLeave={() => setHoverTooltip(null)}
                      role="gridcell"
                      tabIndex={0}
                      aria-label={`Стак Банок ОЗ (+250): ${cell.count} шт.`}
                      className="relative flex h-14 flex-col items-center justify-center rounded-lg border border-rose-500/45 bg-[#1b121a] p-1 select-none hover:border-rose-400"
                    >
                      <SpecialInventoryIcon kind="potion_hp" className="h-7 w-7" />
                      <span className="mt-0.5 text-[9px] font-bold text-rose-200">БАНКИ ОЗ</span>
                      <span className="absolute right-1 top-1 rounded bg-black/80 px-1 font-mono-num text-[10px] font-extrabold text-rose-300">
                        ×{cell.count}
                      </span>
                    </div>
                  );
                }

                if (cell.type === 'potion_large_hp_stack') {
                  return (
                    <div
                      key="potion_large_hp_stack"
                      data-testid="inventory-large-hp-stack"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDropOnGridCell(cell, e)}
                      onMouseEnter={(e) =>
                        setHoverTooltip({
                          target: {
                            kind: 'potion',
                            potionType: 'large_hp',
                            count: cell.count,
                            context: 'inventory',
                          },
                          clientX: e.clientX,
                          clientY: e.clientY,
                        })
                      }
                      onMouseMove={updateTooltipCoords}
                      onMouseLeave={() => setHoverTooltip(null)}
                      role="gridcell"
                      tabIndex={0}
                      aria-label={`Стак Больших Банок ОЗ (+500): ${cell.count} шт.`}
                      className="relative flex h-14 flex-col items-center justify-center rounded-lg border border-amber-400/60 bg-gradient-to-b from-[#28131a] to-[#170e15] p-1 select-none hover:border-amber-300"
                    >
                      <SpecialInventoryIcon kind="potion_large_hp" className="h-7 w-7" />
                      <span className="mt-0.5 text-[9px] font-bold text-amber-200">БОЛ. ОЗ</span>
                      <span className="absolute right-1 top-1 rounded bg-black/80 px-1 font-mono-num text-[10px] font-extrabold text-amber-300">
                        ×{cell.count}
                      </span>
                    </div>
                  );
                }

                if (cell.type === 'potion_mp_stack') {
                  return (
                    <div
                      key="potion_mp_stack"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDropOnGridCell(cell, e)}
                      onMouseEnter={(e) =>
                        setHoverTooltip({
                          target: {
                            kind: 'potion',
                            potionType: 'mp',
                            count: cell.count,
                            context: 'inventory',
                          },
                          clientX: e.clientX,
                          clientY: e.clientY,
                        })
                      }
                      onMouseMove={updateTooltipCoords}
                      onMouseLeave={() => setHoverTooltip(null)}
                      role="gridcell"
                      tabIndex={0}
                      aria-label={`Стак Банок Маны: ${cell.count} шт.`}
                      className="relative flex h-14 flex-col items-center justify-center rounded-lg border border-sky-500/45 bg-[#111926] p-1 select-none hover:border-sky-400"
                    >
                      <SpecialInventoryIcon kind="potion_mp" className="h-7 w-7" />
                      <span className="mt-0.5 text-[9px] font-bold text-sky-200">БАНКИ МН</span>
                      <span className="absolute right-1 top-1 rounded bg-black/80 px-1 font-mono-num text-[10px] font-extrabold text-sky-300">
                        ×{cell.count}
                      </span>
                    </div>
                  );
                }

                if (cell.type === 'quest_item_cell') {
                  return (
                    <div
                      key="quest_item_cell"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDropOnGridCell(cell, e)}
                      onMouseEnter={(e) => {
                        setSelectedTarget({ kind: 'quest_item' });
                        setHoverTooltip({
                          target: {
                            kind: 'quest_item',
                            name: cell.name,
                            hasItem: cell.hasItem,
                          },
                          clientX: e.clientX,
                          clientY: e.clientY,
                        });
                      }}
                      onMouseMove={updateTooltipCoords}
                      onMouseLeave={() => setHoverTooltip(null)}
                      onClick={() => setSelectedTarget({ kind: 'quest_item' })}
                      role="gridcell"
                      tabIndex={0}
                      aria-label={`Квестовый предмет 1-й профессии: ${cell.hasItem ? cell.name : 'Не выбит'}`}
                      className={`relative flex h-14 flex-col items-center justify-center rounded-lg border p-1 select-none cursor-pointer ${
                        cell.hasItem
                          ? 'border-amber-400 bg-amber-500/20 shadow-[inset_0_0_10px_rgba(251,191,36,0.3)]'
                          : 'border-amber-500/20 bg-[#15121d] opacity-55'
                      }`}
                    >
                      <SpecialInventoryIcon kind="quest" classId={player.classId} className="h-7 w-7" />
                      <span className="mt-0.5 max-w-full truncate text-[8px] font-bold text-amber-200">
                        {cell.hasItem ? '★ КВЕСТ' : 'КВЕСТ 50'}
                      </span>
                      <span className="absolute right-1 top-0.5 rounded bg-black/80 px-1 font-mono-num text-[9px] font-extrabold text-amber-300">
                        {cell.hasItem ? '1/1' : '0/1'}
                      </span>
                    </div>
                  );
                }

                if (cell.type === 'equipment') {
                  const { item } = cell;
                  const isSelected =
                    selectedTarget?.kind === 'inventory' && selectedTarget.itemId === item.id;
                  const shortItemLabel = formatShortInventoryItemLabel(item.name);

                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) =>
                        beginDrag({ source: 'inventory', itemId: item.id }, e)
                      }
                      onDragEnd={() => onSetDragPayload(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDropOnGridCell(cell, e)}
                      onMouseEnter={(e) => {
                        setSelectedTarget({ kind: 'inventory', itemId: item.id });
                        setHoverTooltip({
                          target: {
                            kind: 'equipment',
                            item,
                            context: 'inventory',
                            canQuickSell: shopOpen || isNearShop,
                          },
                          clientX: e.clientX,
                          clientY: e.clientY,
                        });
                      }}
                      onMouseMove={updateTooltipCoords}
                      onMouseLeave={() => setHoverTooltip(null)}
                      onClick={(e) => handleInventoryItemClick(item, e)}
                      onDoubleClick={(e) => handleInventoryItemEquip(item, e)}
                      onContextMenu={(e) => handleInventoryItemEquip(item, e)}
                      role="gridcell"
                      tabIndex={0}
                      data-testid={`inventory-item-${item.slot}`}
                      aria-label={`Ячейка предмета ${item.name} +${item.level}`}
                      className={`relative flex h-14 flex-col items-center justify-center rounded-lg border p-1 cursor-pointer select-none ${getRarityBorderClass(
                        item.rarity
                      )} ${isSelected ? 'ring-2 ring-amber-400' : 'hover:border-amber-300'}`}
                    >
                      <EquipmentItemIcon
                        slot={item.slot}
                        rarity={item.rarity}
                        item={item}
                        fallbackClassId={player.classId}
                        className="h-7 w-7"
                      />
                      <span
                        className={`mt-0.5 max-w-full truncate px-0.5 text-[8px] font-bold leading-tight ${getRarityTextClass(
                          item.rarity
                        )}`}
                      >
                        {shortItemLabel}
                      </span>

                      <span className="absolute right-1 top-0.5 rounded bg-black/80 px-1 font-mono-num text-[9px] font-extrabold text-amber-300">
                        +{item.level}
                      </span>

                      {item.lifeOption > 0 && (
                        <span className="absolute bottom-0.5 left-1 font-mono-num text-[8px] font-bold text-emerald-300">
                          L+{item.lifeOption}
                        </span>
                      )}
                    </div>
                  );
                }

                return (
                  <div
                    key={`empty_${idx}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropOnGridCell(cell, e)}
                    role="gridcell"
                    aria-label={`Пустая ячейка инвентаря ${idx + 1}`}
                    className={`flex h-14 items-center justify-center rounded-lg border ${
                      isDraggingFromShop
                        ? 'border-amber-400/60 bg-amber-500/10'
                        : 'border-white/10 bg-[#0d0b12]/90 hover:border-amber-500/30'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white/10" />
                  </div>
                );
              })}
            </div>

            {/* Blood Castle Materials & Ticket Mini-Row with Custom Icons */}
            <div className="mt-2.5 grid grid-cols-3 gap-1.5 border-t border-white/10 pt-2">
              <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-[#181118] px-2 py-1">
                <SpecialInventoryIcon kind="blood_scroll" className="h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[10px] font-bold text-rose-200">Blood Scroll</div>
                  <div className="font-mono-num text-[10px] font-extrabold text-amber-300">
                    ×{player.bloodScrolls} шт.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-[#181118] px-2 py-1">
                <SpecialInventoryIcon kind="blood_fang" className="h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[10px] font-bold text-rose-200">Blood Fang</div>
                  <div className="font-mono-num text-[10px] font-extrabold text-amber-300">
                    ×{player.bloodFangs} шт.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/35 bg-[#1b141a] px-2 py-1">
                <SpecialInventoryIcon kind="blood_castle_ticket" className="h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[10px] font-bold text-amber-200">Билет BC</div>
                  <div className="font-mono-num text-[10px] font-extrabold text-emerald-300">
                    ×{player.bloodCastleTickets} шт.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SELECTED / HOVERED ITEM QUICK ACTIONS BAR */}
          <div className="rounded-xl border border-amber-500/30 bg-[#161221] p-3">
            {inspectedEquipment ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border p-1.5 ${getRarityBorderClass(
                      inspectedEquipment.item.rarity
                    )}`}
                  >
                    <EquipmentItemIcon
                      slot={inspectedEquipment.slot}
                      rarity={inspectedEquipment.item.rarity}
                      item={inspectedEquipment.item}
                      fallbackClassId={player.classId}
                      className="h-8 w-8"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`font-display text-sm font-bold ${getRarityTextClass(
                          inspectedEquipment.item.rarity
                        )}`}
                      >
                        {inspectedEquipment.item.name} +{inspectedEquipment.item.level}
                      </span>
                      <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-[#d6cec2]">
                        {SLOT_LABELS[inspectedEquipment.slot]} ·{' '}
                        {inspectedEquipment.isEquipped ? 'Надето на герое' : 'В сетке сумки'}
                      </span>
                    </div>
                    <div className="mt-1 font-mono-num text-xs text-[#dfd7c8]">
                      {inspectedEquipment.item.baseAttack > 0 &&
                        `Атака: ${calculateItemEffectiveAttack(inspectedEquipment.item)} · `}
                      {inspectedEquipment.item.baseDefense > 0 &&
                        `Защита: ${calculateItemEffectiveDefense(inspectedEquipment.item)} · `}
                      Крит: +{inspectedEquipment.item.critChanceBonus}%
                      {inspectedEquipment.item.lifeOption > 0 &&
                        ` · Опция Life: +${inspectedEquipment.item.lifeOption}`}
                    </div>
                    {inspectedEquipment.item.excellentOption && (
                      <div className="mt-0.5 text-[11px] font-medium text-emerald-300">
                        ✦ {inspectedEquipment.item.excellentOption}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {inspectedEquipment.isEquipped ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleEquippedSlotUnequip(inspectedEquipment.slot)}
                        className="min-h-[38px] rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-[#09080c] hover:bg-amber-400 cursor-pointer whitespace-nowrap"
                      >
                        Снять в инвентарь
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const msg = onDropEquippedSlot(inspectedEquipment.slot);
                          setStatusBanner(msg);
                          setSelectedTarget(null);
                        }}
                        title="Снять предмет и выбросить на землю (видно союзникам 60 сек)"
                        className="min-h-[38px] rounded-xl border border-rose-400/50 bg-rose-500/15 px-2.5 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/25 cursor-pointer whitespace-nowrap"
                      >
                        ⬇️ На землю
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleInventoryItemEquip(inspectedEquipment.item)}
                        className="min-h-[38px] rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-[#09080c] hover:bg-amber-400 cursor-pointer whitespace-nowrap"
                      >
                        Надеть на героя
                      </button>
                      {isNearShop && (
                        <button
                          type="button"
                          onClick={() => {
                            onSellItem(inspectedEquipment.item);
                            setStatusBanner(
                              `Продано торговцу Ханзо: ${inspectedEquipment.item.name} за +${inspectedEquipment.item.valueZen} Zen.`
                            );
                            setSelectedTarget(null);
                          }}
                          className="gothic-button min-h-[38px] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[#dfd7c8] cursor-pointer whitespace-nowrap"
                        >
                          Продать (+{inspectedEquipment.item.valueZen}z)
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const msg = onDropInventoryItem(inspectedEquipment.item);
                          setStatusBanner(msg);
                          setSelectedTarget(null);
                        }}
                        title="Выбросить предмет на землю (видно союзникам 60 сек)"
                        className="min-h-[38px] rounded-xl border border-rose-400/50 bg-rose-500/15 px-2.5 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/25 cursor-pointer whitespace-nowrap"
                      >
                        ⬇️ Выбросить
                      </button>
                    </>
                  )}

                  {inspectedEquipment.slot === 'wings' ? (
                    <span className="rounded-xl border border-purple-400/35 bg-purple-950/40 px-2.5 py-1.5 font-mono-num text-[10px] font-semibold text-purple-200">
                      ⚙️ Заточка: Машина Хаоса [K] (до +9: 1B+1S+1C · +10..+15: 3B+3S+3C)
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={player.jewels.bless <= 0}
                        onClick={() =>
                          handleApplyJewelToItem(inspectedEquipment.item.id, 'bless')
                        }
                        title="Заточить камнем Jewel of Bless (+1 уровень)"
                        className="gothic-button min-h-[38px] rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-purple-200 disabled:opacity-35 cursor-pointer"
                      >
                        +Bless ({player.jewels.bless})
                      </button>
                      <button
                        type="button"
                        disabled={player.jewels.life <= 0}
                        onClick={() =>
                          handleApplyJewelToItem(inspectedEquipment.item.id, 'life')
                        }
                        title="Усилить камнем Jewel of Life (+4 опция)"
                        className="gothic-button min-h-[38px] rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-amber-200 disabled:opacity-35 cursor-pointer"
                      >
                        +Life ({player.jewels.life})
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#a99f90]">
                Наведите курсор мыши на любую вещь или камень в сетке выше — откроется всплывающее окно с полными характеристиками предмета.
              </div>
            )}
          </div>

          {/* DRAG-AND-DROP GROUND DROP ZONE */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isDraggingDroppableItem) setDropZoneHover(true);
            }}
            onDragLeave={() => setDropZoneHover(false)}
            onDrop={handleDropOnGroundZone}
            data-testid="ground-drop-zone"
            className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-3 py-2 text-center text-xs font-semibold transition-colors ${
              dropZoneHover
                ? 'border-rose-400 bg-rose-500/25 text-rose-100 shadow-[0_0_16px_rgba(244,63,94,0.35)]'
                : isDraggingDroppableItem
                  ? 'border-amber-400/80 bg-amber-500/15 text-amber-200'
                  : 'border-white/15 bg-[#120f1b] text-[#a99f90]'
            }`}
          >
            <span>⬇️</span>
            <span>
              {dropZoneHover
                ? 'Отпустите предмет, чтобы выбросить его на землю!'
                : 'Перетащите предмет сюда (или за пределы окна), чтобы выбросить на землю на 60 сек'}
            </span>
          </div>

          {/* CITY MERCHANT PROXIMITY STATUS BAR (Replaces embedded shop) */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-[#151221] px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-amber-300">
                🏪 Покупка экипировки, книг скилов и банок
              </div>
              <div className="text-[11px] text-[#bfb5a4]">
                {isNearShop
                  ? shopOpen
                    ? 'Лавка Ханзо открыта слева! Перетащите товары мышкой в сетку Инвентаря.'
                    : 'Вы стоите рядом с Лавкой Ханзо в городе — откройте окно Магазина, чтобы перетащить вещи в инвентарь.'
                  : '🔒 Покупать вещи и книги навыков можно только подойдя к Лавке Торговца Ханзо в городе!'}
              </div>
            </div>
            {!shopOpen && (
              <button
                type="button"
                onClick={onOpenShop}
                className={`min-h-[36px] shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer ${
                  isNearShop
                    ? 'bg-amber-500 text-[#09080c] hover:bg-amber-400'
                    : 'gothic-button text-amber-200'
                }`}
              >
                {isNearShop ? '🏪 Открыть Лавку [B]' : '🚶 Подойти к Лавке'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Floating Mouse-Hover Item Tooltip Window */}
      <ItemHoverTooltip tooltip={hoverTooltip} />
    </>
  );
};
