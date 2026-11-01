'use strict';

const assert = require('node:assert/strict');

// One projection for Build and Handbook. IO, localization, curves and media use
// the existing build-mmo-card runtime; there is no second raw extractor.
module.exports = function buildMmoExpansion({files, rows, loc, locAll, locKey, icon, curve, sources, sharedGearIcons = {}, sharedGearNames = {}, published}) {
  const slotRows = rows(files.slots);
  const slotByEnum = new Map(Object.entries(slotRows).map(([id, row]) => [row.Slot, id]));
  assert.equal(slotByEnum.size, Object.keys(slotRows).length, 'duplicate MMO slot enum');
  const sharedByEnum = new Map(Object.entries(sharedGearIcons).map(([id, entry]) => [entry.slot, {id, ...entry}]));
  const slots = Object.entries(slotRows).map(([id, row]) => {
    const shared = sharedByEnum.get(row.Slot);
    const sharedIcon = shared && published(shared.icons?.normal);
    const name = Object.fromEntries(Object.entries(locAll(row.SlotName) || {}).filter(([, value]) => typeof value === 'string' && value.trim()));
    const nameSources = {};
    for (const locale of ['en', 'ru', 'de', 'es', 'fr', 'id', 'ja', 'ko', 'pt', 'th', 'zh-CN']) {
      const sharedName = sharedGearNames[shared?.id]?.[locale];
      if (typeof sharedName !== 'string' || !sharedName.trim()) continue;
      name[locale] = sharedName;
      nameSources[locale] = {path: 'game-data/build-page.json', row: shared.id, field: `gear[].name.${locale}`};
    }
    for (const locale of Object.keys(name)) nameSources[locale] ??= {
      path: files.localization(locale), row: row.SlotName?.Key, namespace: row.SlotName?.Namespace ?? '', field: `${files.slots}#${id}.SlotName`,
    };
    return {
      id, slot: row.Slot.replace('EQUIPMENT_SLOT_', ''), name: Object.keys(name).length ? name : null,
      ...(Object.keys(nameSources).length ? {nameSources} : {}),
      icon: sharedIcon || icon(row.SlotIcon), frame: icon(row.WidgetSlotIcon),
      iconSource: sharedIcon ? {kind: 'shared-gear', path: 'game-data/build-gear-icons.json', row: shared.id, field: 'icons.normal'}
        : {kind: 'slot-config', path: files.slots, row: id, field: 'SlotIcon'},
      cardBanks: row.SkillBankNumber, seasonCardBanks: row.SeasonSkillBankNumber,
    };
  });

  // The source item lists installation slots in the first <Blue> fragment.
  // SlotName.SourceString supplies the vocabulary (e.g. 臂甲附魔卡1 → 臂甲).
  // This is a text-derived fallback, not a replacement for OwnSlotDatas. Unknown
  // formats/tokens remain unresolved, with their evidence retained below.
  const aliases = new Map();
  for (const [id, row] of Object.entries(slotRows)) {
    const source = row.SlotName?.SourceString;
    if (!source || !/附魔卡\d+$/u.test(source)) continue;
    const alias = source.replace(/附魔卡\d+$/u, '');
    const matches = aliases.get(alias) ?? [];
    aliases.set(alias, [...matches, id]);
  }
  const attributes = rows(files.attributes);
  const starRows = rows(files.cardAttributes);
  const items = rows(files.itemConfigs);
  const cardRows = rows(files.cards);
  // If the shared Gacha catalog is unavailable, four advanced-slot enum labels
  // are absent from QRSLCommon_ST in this export.
  // Reuse the localized slot words at the same positions as the verified source
  // tokens, retaining the exact item/FText evidence for each missing label.
  for (const card of Object.values(cardRows)) {
    const item = items[card.SkillBookItemID];
    const source = item?.UseDescription;
    const tokens = source?.SourceString?.split(/\r?\n/)[0].match(/<Blue>([^<]+)<\/>/i)?.[1].split('/');
    if (!tokens) continue;
    const translated = loc(source);
    for (const locale of ['en', 'ru']) {
      const words = translated?.[locale]?.split(/\r?\n/)[0].match(/<Blue>([^<]+)<\/>/i)?.[1].split('/');
      if (words?.length !== tokens.length) continue;
      tokens.forEach((token, index) => {
        const ids = aliases.get(token.trim());
        if (ids?.length !== 1) return;
        const slot = slots.find(value => value.id === ids[0]);
        if (!slot || slot.name?.[locale]) return;
        slot.name = {...(slot.name ?? {en: null, ru: null}), [locale]: words[index].trim()};
        slot.nameSources ??= {};
        slot.nameSources[locale] = {path: files.itemConfigs, row: card.SkillBookItemID, field: 'UseDescription', key: source.Key};
      });
    }
  }
  const coefficients = Object.fromEntries(Object.entries(rows(files.cardCoefficients)).map(([prop, row]) => {
    const keys = curve(row.LevelCoefficient);
    assert.ok(keys, `MMO expansion coefficient ${prop}`);
    return [prop, keys.map(([time, value]) => [time, Number((row.LevelCoefficient.Value * value).toFixed(8))])];
  }));
  const usedAttributes = new Set();
  const coverage = {cards: 0, configuredSlots: 0, describedSlots: 0, missingSlots: [],
    unknownSlotEnums: [], missingItems: [], missingMedia: [], descriptionSlotConflicts: []};

  const cards = Object.entries(cardRows).map(([id, row]) => {
    assert.ok(Number.isInteger(row.MaxStarLevel) && row.MaxStarLevel >= 0, `MMO card stars ${id}`);
    const rawSlots = row.OwnSlotDatas ?? [];
    const configured = rawSlots.flatMap(value => slotByEnum.has(value) ? [slotByEnum.get(value)] : []);
    const unknown = rawSlots.filter(value => value !== 'EQUIPMENT_SLOT_NONE' && !slotByEnum.has(value));
    if (unknown.length) coverage.unknownSlotEnums.push({card: id, values: unknown});
    const item = items[row.SkillBookItemID];
    if (!item) coverage.missingItems.push(id);
    const sourceText = item?.UseDescription?.SourceString ?? '';
    const firstLine = sourceText.split(/\r?\n/)[0];
    const tokens = firstLine.match(/<Blue>([^<]+)<\/>/i)?.[1].split('/').map(value => value.trim()) ?? [];
    const descriptionSlots = tokens.map(token => aliases.get(token));
    const described = descriptionSlots.length && descriptionSlots.every(matches => matches?.length === 1)
      ? descriptionSlots.map(matches => matches[0]) : [];
    if (configured.length && described.length && [...configured].sort().join() !== [...described].sort().join()) {
      coverage.descriptionSlotConflicts.push(id);
    }
    const kind = configured.length && !unknown.length ? 'configuration'
      : !unknown.length && described.length ? 'item-description' : 'unresolved';
    const resolved = kind === 'configuration' ? configured : kind === 'item-description' ? described : [];
    if (kind === 'configuration') coverage.configuredSlots++;
    else if (kind === 'item-description') coverage.describedSlots++;
    else coverage.missingSlots.push(id);
    const levels = !row.SkillBaseAttributeID || row.SkillBaseAttributeID === 'None' ? []
      : Array.from({length: row.MaxStarLevel + 1}, (_, stars) => {
        const key = `${row.SkillBaseAttributeID}_${stars}`;
        assert.ok(starRows[key]?.ModifyData, `MMO expansion attributes ${id}: ${key}`);
        return starRows[key].ModifyData;
      });
    const stats = (levels[0] ?? []).map(entry => {
      assert.ok(coefficients[entry.PropName], `MMO expansion coefficient ${entry.PropName}`);
      usedAttributes.add(entry.PropName);
      return {prop: entry.PropName, values: levels.map(level => {
        const match = level.find(value => value.PropName === entry.PropName);
        assert.ok(match, `MMO expansion star stat ${id}: ${entry.PropName}`);
        return Number(match.PropValue.toFixed(8));
      })};
    });
    for (const level of levels) assert.equal(level.length, stats.length, `MMO expansion star stat set ${id}`);
    const cardIcon = icon(row.SkillIcon);
    if (!cardIcon) coverage.missingMedia.push(id);
    const reference = {path: files.cards, row: id};
    return {id, name: loc(row.SkillName), icon: cardIcon, quality: row.SkillQuality.replace('ITEM_QUALITY_', '').toLowerCase(),
      season: row.SeasonIndex, exclusive: row.bSeasonExclusiveSkill, maxStars: row.MaxStarLevel,
      maxSuit: row.BuffMaxSuitAmount, slots: [...new Set(resolved)], description: loc(row.SkillDetail),
      params: row.SkillStarsParam.map(param => ({value: param.Value, curve: curve(param)})), stats,
      item: item ? {id: row.SkillBookItemID, name: loc(item.ItemName), icon: icon(item.ItemIcon),
        description: loc(item.Description), useDescription: loc(item.UseDescription)} : null,
      slotEvidence: {kind, configured, rawSlots, described, tokens, sourceText,
        source: kind === 'configuration' ? {...reference, field: 'OwnSlotDatas'}
          : {path: files.itemConfigs, row: row.SkillBookItemID, field: 'UseDescription.SourceString'}},
      validSeasons: row.ValidSeasonData ?? [], exhibit: row.bSeasonExhibit ?? null,
      upgradeAmounts: row.StarLevelUpgradeAmount ?? [],
      buffs: (row.BuffObjectArray ?? []).map(ref => ref.AssetPathName).filter(ref => ref && ref !== 'None'),
      source: reference};
  }).sort((a, b) => b.season - a.season || a.id.localeCompare(b.id, undefined, {numeric: true}));
  coverage.cards = cards.length;
  const statCatalog = Object.fromEntries([...usedAttributes].map(prop => {
    const row = attributes[prop];
    assert.ok(row, `MMO expansion attribute metadata ${prop}`);
    return [prop, {name: loc(row.AttributeText), icon: icon(row.AttributeIcon),
      percent: Boolean(row.bShowPercent), description: loc(row.AttributeDescription)}];
  }));
  const seasonRows = file => Object.entries(rows(file)).map(([id, row]) => ({id, index: row.SeasonIndex, name: loc(row.SeasonName)}));
  const equipmentSeasons = seasonRows(files.equipmentSeasons);
  const serverSeasons = seasonRows(files.serverSeasons);
  const seasons = [...new Set(cards.map(card => card.season))].sort((a, b) => b - a)
    .map(index => ({index, name: equipmentSeasons.find(season => season.index === index)?.name ?? null}));
  return {schemaVersion: 1, sources: {...sources}, cards, slots, attributes: statCatalog,
    coefficients, seasons, equipmentSeasons, serverSeasons, coverage};
};
