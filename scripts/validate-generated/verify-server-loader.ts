import {
  loadServerGameData,
  loadServerSimulacra,
  loadServerMatrices,
  loadServerRelics,
  loadServerPets,
  loadServerFood,
  loadServerCosmetics,
  loadServerArts,
  loadServerReleaseManifest,
  loadServerChangelogBaseline,
  assertPathWithinRoot,
  resolveServerDatasetPath,
} from '../../apps/web/src/lib/game-data-server';

async function verify() {
  console.log('Testing Server Game Data Loaders...');

  // 1. Release manifest
  const manifest = await loadServerReleaseManifest();
  if (!manifest.snapshot.version || manifest.gameVersion !== manifest.snapshot.version) {
    throw new Error(`Game version ${manifest.gameVersion} does not match snapshot ${manifest.snapshot.version}`);
  }
  if (!manifest.locales.includes('en') || !manifest.locales.includes('ru')) {
    throw new Error('Manifest missing en/ru locales');
  }
  console.log('✔ loadServerReleaseManifest passed');

  // 2. Simulacra EN
  const simEn = await loadServerSimulacra('en');
  if (simEn.total !== 73 || simEn.items.length !== 73) {
    throw new Error(`Expected 73 simulacra, got ${simEn.total}`);
  }
  const alyssEn = simEn.items.find((i) => i.id === 'alyss');
  if (!alyssEn || alyssEn.name !== 'Alyss') {
    throw new Error(`Expected Alyss, got ${alyssEn?.name}`);
  }
  console.log('✔ loadServerSimulacra (EN) passed');

  // 3. Simulacra RU
  const simRu = await loadServerSimulacra('ru');
  const alyssRu = simRu.items.find((i) => i.id === 'alyss');
  if (!alyssRu || alyssRu.name !== 'Алисс') {
    throw new Error(`Expected Алисс, got ${alyssRu?.name}`);
  }
  console.log('✔ loadServerSimulacra (RU) passed');

  // 4. Matrices
  const matrices = await loadServerMatrices('en');
  if (matrices.total !== 88) {
    throw new Error(`Expected 88 matrices, got ${matrices.total}`);
  }
  console.log('✔ loadServerMatrices passed');

  // 5. Relics
  const relics = await loadServerRelics('en');
  if (relics.total !== 85) {
    throw new Error(`Expected 85 relics, got ${relics.total}`);
  }
  console.log('✔ loadServerRelics passed');

  // 6. Pets
  const pets = await loadServerPets('en');
  if (pets.total !== 147) {
    throw new Error(`Expected 147 pets, got ${pets.total}`);
  }
  console.log('✔ loadServerPets passed');

  // 7. Food
  const food = await loadServerFood('en');
  if (food.total !== 227) {
    throw new Error(`Expected 227 food dishes, got ${food.total}`);
  }
  console.log('✔ loadServerFood passed');

  // 8. Cosmetics
  const cosmetics = await loadServerCosmetics('en');
  if (cosmetics.total !== 3149) {
    throw new Error(`Expected 3149 cosmetics, got ${cosmetics.total}`);
  }
  console.log('✔ loadServerCosmetics passed');

  // 9. Arts
  const arts = await loadServerArts('en');
  if (arts.total !== 346) {
    throw new Error(`Expected 346 arts, got ${arts.total}`);
  }
  console.log('✔ loadServerArts passed');

  // 10. Changelog baselines
  const gachaBase = await loadServerChangelogBaseline<any>('gacha');
  if (!gachaBase.characters || Object.keys(gachaBase.characters).length !== 73) {
    throw new Error(`Expected 73 gacha baseline chars, got ${Object.keys(gachaBase.characters || {}).length}`);
  }
  const mmoBase = await loadServerChangelogBaseline<any>('mmo');
  if (!mmoBase.characters || Object.keys(mmoBase.characters).length !== 59) {
    throw new Error(`Expected 59 mmo baseline chars, got ${Object.keys(mmoBase.characters || {}).length}`);
  }
  console.log('✔ loadServerChangelogBaseline passed');

  // 11. Path traversal security check
  try {
    assertPathWithinRoot('/example/tof-hub/apps/web/public/game-data/../../../evil', '/example/tof-hub/apps/web/public/game-data');
    throw new Error('Path traversal was NOT blocked!');
  } catch (e: any) {
    if (e.message.includes('Security violation')) {
      console.log('✔ Path traversal guard blocked traversal attempt');
    } else {
      throw e;
    }
  }

  // 12. Missing file throwOnNotFound: false
  const missing = await loadServerGameData('en', 'non-existent-dataset-xyz', { throwOnNotFound: false });
  if (missing !== null) {
    throw new Error(`Expected null for missing dataset, got ${missing}`);
  }
  console.log('✔ throwOnNotFound: false returned null correctly');

  console.log('🎉 All Server Game Data Loader checks verified successfully!');
}

verify().catch((err) => {
  console.error('❌ Server Game Data Loader verification failed:', err);
  process.exit(1);
});
