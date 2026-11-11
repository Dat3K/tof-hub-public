# Titan Calculator

`/tools/titan/` compares legal Titan level sets for a Global damage parse.
Enter Final DMG for each of the three weapons or read it from game screenshots.
Enter the six Titan levels worn during the parse, read them from a screenshot
or load them from a Build draft in the current browser.

The calculator divides each damage category by the multiplier of the worn set,
then applies each candidate set. The two rankings model full Weak Point uptime
and zero uptime. An optional parse for Others contributes unscaled damage to
the total. The result includes damage shares, gains, legal slot assignments and
a PNG export. Load example fills the damage and Titan inputs. Its screenshot
guide appears when the installation has the four example images under
`apps/web/public/examples/titan/`.

## Data sources

`scripts/generators/build-handbook.cjs` projects the generated Build catalog
into `game-data/handbook/titan.json`. The calculator consumes the rare stat
curves and the slot pools in that file.

| Raw table under `Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Equipment/` | Fields |
| --- | --- |
| `RedEquipmentAttrDataTable_Overseas.json` | `Rows[attributeId].Keys[].Time` is the summed level and `Value` is the bonus as a fraction. Intermediate levels use the curve interpolation. |
| `EquipmentDataTable_Overseas.json` | The SSR equipment row's `TupoRedItemID` identifies the Titan row and its `UncommonPackId`. |
| `EquipUncommonModifyData_Overseas.json` | `Rows[packId].UncommonModifyInfoList[]` gives `ModifyID`, `PropLevel` and `Weight`. The candidate levels use entries with positive weight. |

The model assumes multiplicative stacking. Normal Attack, Dodge, Skill and
Discharge affect their own categories. Damage Boost and Weak Point affect every
category, including Passive. The in-game stacking formula remains unverified.

## Screenshot input

The local OCR worker reads PNG, JPEG and WebP. The calculator validates file
size and raster dimensions before processing. Inputs and previews stay in the
browser. Review any repaired or ambiguous values before comparing results.
Screenshot text is in the model tests, including values with decimal commas
and the game's `k`, `m` and `g` units.
