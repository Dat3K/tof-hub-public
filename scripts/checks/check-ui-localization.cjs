const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require('tsx/cjs');
const { translateUiText } = require('../../packages/i18n/src/ui-text.ts');
const { en } = require('../../packages/i18n/src/locales/en.ts');
const { SUPPORTED_LOCALES } = require('../../packages/i18n/src/constants.ts');
const { siteUiCorrections } = require('../../packages/i18n/src/locales/extra/site-ui/corrections.ts');
const { SITE_PAGE_COPY } = require('../../packages/config/src/site-pages.ts');
const { ServerRegionSchema } = require('../../packages/contracts/src/wish/servers.ts');
const { FOOD_EFFECT_FILTER_OPTIONS } = require('../../apps/web/src/features/info-sections/food/constants.ts');
const sourceRoot = path.resolve('apps/web/src');
const cultures = SUPPORTED_LOCALES.filter(locale => locale !== 'en');
// This file is an unmounted component gallery fixture, not a route or a production import.
// Keep the exception exact: newly added source folders must still be checked automatically.
const nonRenderedReferenceFiles = new Set(['dev/catalog-demo.tsx']);
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['__tests__', '__fixtures__', '.next'].includes(entry.name)) walk(file);
    } else if (/\.tsx?$/.test(file) && !/\.(?:test|spec)\./.test(file)) files.push(file);
  }
}
walk(sourceRoot);
const used = new Map();
const unresolvedKeys = new Map();
const ruOverrides = new Set();
const dynamicUiLabelIssues = [];
const rawTranslatedUi = [];
const rawMissingUi = [];
const add = (value, file, key = value) => {
  if (typeof value === 'string' && value.trim() && !/^\/(?:[\w.-]+\/?)*$/.test(value.trim()) && !/^https?:\/\//i.test(value.trim())) {
    used.set(value, [...(used.get(value) ?? []), `${path.relative(sourceRoot, file)}${key !== value ? ` (${key})` : ''}`]);
  }
};
const sitePagesFile = path.resolve('packages/config/src/site-pages.ts');
for (const [title] of Object.values(SITE_PAGE_COPY)) add(title, sitePagesFile);
// These visible labels come from typed option lists instead of JSX string literals.
const serverRegionsFile = path.resolve('packages/contracts/src/wish/servers.ts');
for (const region of ServerRegionSchema.options) add(region, serverRegionsFile);
const foodOptionsFile = path.resolve('apps/web/src/features/info-sections/food/constants.ts');
for (const option of FOOD_EFFECT_FILTER_OPTIONS) {
  for (const [english, russian, field] of [
    [option.labelEn, option.labelRu, 'labelRu'],
    [option.shortLabelEn, option.shortLabelRu, 'shortLabelRu'],
  ]) {
    add(english, foodOptionsFile);
    ruOverrides.add(english);
    if (!russian?.trim()) dynamicUiLabelIssues.push(`${option.id}: missing ${field}`);
  }
}
const resolveKey = key => key.split('.').reduce((value, part) => value && typeof value === 'object' ? value[part] : undefined, en);
for (const file of files) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const declarations = new Map();
  const indexDeclarations = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) declarations.set(node.name.text, node.initializer);
    ts.forEachChild(node, indexDeclarations);
  };
  indexDeclarations(source);
  const unwrap = node => {
    while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)
      || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node))) node = node.expression;
    return node;
  };
  const propertyName = property => ts.isPropertyAssignment(property) && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) ? property.name.text : '';
  const collectEnglish = (node, visited = new Set(), hint = '', found = []) => {
    node = unwrap(node);
    if (!node) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) { found.push(node.text); add(node.text, file); return found; }
    if (ts.isIdentifier(node)) {
      const name = node.text;
      if (/(?:^|[_$])(?:RU|RUSSIAN)$/i.test(name)) return;
      const declaration = declarations.get(name);
      if (!declaration || visited.has(name)) return;
      const next = new Set(visited).add(name);
      return collectEnglish(declaration, next, name, found);
    }
    if (ts.isConditionalExpression(node)) {
      const branches = [node.whenTrue, node.whenFalse];
      const english = branches.find(branch => /(?:^|[_$])(?:EN|ENGLISH)(?:$|[_$])/i.test(branch.getText(source)));
      const chosen = english ?? branches.find(branch => !/(?:^|[_$])(?:RU|RUSSIAN)(?:$|[_$])/i.test(branch.getText(source)));
      if (chosen) collectEnglish(chosen, visited, hint, found);
      return found;
    }
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) {
      collectEnglish(node.left, visited, hint, found);
      collectEnglish(node.right, visited, hint, found);
      return found;
    }
    if (ts.isElementAccessExpression(node)) {
      collectEnglish(node.expression, visited, hint, found);
      return found;
    }
    if (ts.isPropertyAccessExpression(node)) {
      if (node.name.text === 'en') {
        const object = unwrap(node.expression);
        if (ts.isObjectLiteralExpression(object)) {
          const english = object.properties.find(property => propertyName(property) === 'en');
          if (english) collectEnglish(english.initializer, visited, hint, found);
        } else collectEnglish(node.expression, visited, hint, found);
      } else {
        const object = unwrap(node.expression);
        if (ts.isObjectLiteralExpression(object)) {
          const property = object.properties.find(item => propertyName(item) === node.name.text);
          if (property) collectEnglish(property.initializer, visited, hint, found);
        } else collectEnglish(node.expression, visited, hint, found);
      }
      return found;
    }
    if (ts.isObjectLiteralExpression(node)) {
      const english = node.properties.find(property => propertyName(property) === 'en');
      if (english) { collectEnglish(english.initializer, visited, hint, found); return found; }
      for (const property of node.properties) {
        if (ts.isPropertyAssignment(property)) {
          const name = propertyName(property);
          if (/^(?:ru|de|es|fr|id|ja|ko|pt|th|zh-CN|zh-Hans|zh-Hans-SG)$/i.test(name)) continue;
          collectEnglish(property.initializer, visited, hint, found);
        } else if (ts.isSpreadAssignment(property)) collectEnglish(property.expression, visited, hint, found);
      }
      return found;
    }
    if (ts.isArrayLiteralExpression(node)) for (const item of node.elements) collectEnglish(item, visited, hint, found);
    return found;
  };
  const findLocale = (node, locale, visited = new Set()) => {
    node = unwrap(node);
    if (!node) return null;
    if (ts.isIdentifier(node)) {
      if (visited.has(node.text)) return null;
      const declaration = declarations.get(node.text);
      return declaration ? findLocale(declaration, locale, new Set(visited).add(node.text)) : null;
    }
    if (ts.isPropertyAccessExpression(node) && node.name.text === locale) return node;
    if (ts.isObjectLiteralExpression(node)) {
      const direct = node.properties.find(property => propertyName(property) === locale);
      if (direct) return direct.initializer;
      for (const property of node.properties) if (ts.isSpreadAssignment(property)) {
        const found = findLocale(property.expression, locale, visited);
        if (found) return found;
      }
    }
    return null;
  };
  const identifiers = node => {
    const names = [];
    const visitIdentifier = current => {
      if (ts.isIdentifier(current)) names.push(current.text);
      ts.forEachChild(current, visitIdentifier);
    };
    visitIdentifier(node);
    return names;
  };
  const localeTextNames = new Set();
  const i18nTNames = new Set();
  const findLocaleText = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isCallExpression(node.initializer) && ts.isIdentifier(node.initializer.expression) && node.initializer.expression.text === 'localeText') {
      localeTextNames.add(node.name.text);
    }
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer) && ts.isIdentifier(node.initializer.expression) && ['useI18n', 'useTranslation'].includes(node.initializer.expression.text) && ts.isObjectBindingPattern(node.name)) {
      for (const element of node.name.elements) {
        const sourceName = element.propertyName && ts.isIdentifier(element.propertyName) ? element.propertyName.text : ts.isIdentifier(element.name) ? element.name.text : '';
        if (sourceName === 't' && ts.isIdentifier(element.name)) i18nTNames.add(element.name.text);
      }
    }
    ts.forEachChild(node, findLocaleText);
  };
  findLocaleText(source);
  const renderedCopyAttributes = /^(?:alt|title|placeholder|label|message|submessage|description|caption|heading|lead|summary|disclaimer|tooltip|emptyTitle|emptyDescription|confirmLabel|cancelLabel|retryLabel|homeLabel|actionLabel|copyLabel|copiedLabel|closeLabel|openLabel|errorLabel|successLabel|loadingLabel|aria-(?:label|description|roledescription|valuetext|errormessage))$/;
  const localizedCallNames = new Set(['translateUiText', 'localizeUiCopy', 'localizedUi', ...localeTextNames, ...i18nTNames]);
  const hasLocalizedCall = expression => {
    let found = false;
    const visitCall = node => {
      if (ts.isCallExpression(node)) {
        const name = ts.isIdentifier(node.expression) ? node.expression.text : '';
        const nestedName = ts.isCallExpression(node.expression) && ts.isIdentifier(node.expression.expression)
          ? node.expression.expression.text : '';
        if (localizedCallNames.has(name) || nestedName === 'localeText') found = true;
      }
      if (!found) ts.forEachChild(node, visitCall);
    };
    visitCall(expression);
    return found;
  };
  const literalCopy = node => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (!ts.isTemplateExpression(node)) return null;
    let result = node.head.text;
    node.templateSpans.forEach((span, index) => {
      result += `{${index}}${span.literal.text}`;
    });
    return result;
  };
  const visit = node => {
    const recordRawUi = (value, node, kind) => {
      const phrase = value.replace(/\s+/g, ' ').trim();
      if (!phrase || !/[\p{L}\p{N}]/u.test(phrase) || /^https?:\/\//i.test(phrase)) return;
      const relativeFile = path.relative(sourceRoot, file).replace(/\\/g, '/');
      // These authored React fragments are source inputs for the dedicated rich-copy mapper.
      // The mapper replaces the complete fields with localized rich strings, so their child
      // literals are not rendered as-is. Single-letter grade markers remain game notation.
      if (nonRenderedReferenceFiles.has(relativeFile) || relativeFile === 'features/datamine/multype/guide/guide-copy.tsx' || /^[A-Z]$/.test(phrase)) return;
      const translated = cultures.some(culture => translateUiText(phrase, culture) !== phrase);
      const reviewedIdentity = cultures.every(culture => {
        const identityCulture = culture.startsWith('zh-') ? 'zh-CN' : culture;
        return siteUiCorrections[identityCulture]?.[phrase] === phrase;
      });
      const withoutPlaceholders = phrase.replace(/\{\d+\}/g, '');
      const codeLike = /[=×Σλⱼ]|[{}<>]/.test(withoutPlaceholders) || /\b[A-Za-z]+(?:[A-Z][A-Za-z]+){1,}\b/.test(withoutPlaceholders);
      const naturalPhrase = withoutPlaceholders.length >= 8 && /\s/.test(withoutPlaceholders) && /[a-z]{3}/i.test(withoutPlaceholders);
      const labelText = withoutPlaceholders.replace(/[.!…:]+$/g, '').trim();
      const visibleKind = kind.startsWith('JSX') || renderedCopyAttributes.test(kind);
      const simpleLabel = visibleKind && labelText.length >= 3
        && /^[\p{L}][\p{L}\p{M}'’/-]*(?:\s+[\p{L}][\p{L}\p{M}'’/-]*){0,2}$/u.test(labelText)
        && !/^(?:[A-Z0-9]+(?:[ /·+.-][A-Z0-9]+)*)$/.test(labelText);
      if (translated || (naturalPhrase || simpleLabel) && !codeLike && !reviewedIdentity) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        const issue = { file: path.relative(sourceRoot, file), line: line + 1, kind, phrase };
        if (translated) rawTranslatedUi.push(issue);
        else rawMissingUi.push(issue);
      }
    };
    const recordRenderedExpression = (expression, jsxNode, kind, visited = new Set()) => {
      expression = unwrap(expression);
      if (!expression) return;
      const literal = literalCopy(expression);
      if (literal !== null) { recordRawUi(literal, jsxNode, kind); return; }
      if (ts.isIdentifier(expression) && !visited.has(expression.text)) {
        const declaration = declarations.get(expression.text);
        if (declaration) recordRenderedExpression(declaration, jsxNode, kind, new Set(visited).add(expression.text));
        return;
      }
      if (ts.isConditionalExpression(expression)) {
        recordRenderedExpression(expression.whenTrue, jsxNode, kind, visited);
        recordRenderedExpression(expression.whenFalse, jsxNode, kind, visited);
        return;
      }
      if (ts.isBinaryExpression(expression) && [
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
        ts.SyntaxKind.AmpersandAmpersandToken,
      ].includes(expression.operatorToken.kind)) {
        // For `condition && <Thing />`, the left side decides visibility but is never rendered.
        if (expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
          recordRenderedExpression(expression.right, jsxNode, kind, visited);
        } else {
          recordRenderedExpression(expression.left, jsxNode, kind, visited);
          recordRenderedExpression(expression.right, jsxNode, kind, visited);
        }
        return;
      }
      if (hasLocalizedCall(expression)) return;
    };
    if (ts.isJsxText(node)) recordRawUi(node.text, node, 'JSX text');
    if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent) && node.expression) {
      recordRenderedExpression(node.expression, node, 'JSX child expression');
    }
    if (ts.isJsxAttribute(node) && node.initializer && renderedCopyAttributes.test(node.name.getText(source))) {
      const initializer = node.initializer;
      if (ts.isStringLiteral(initializer)) recordRawUi(initializer.text, node, node.name.getText(source));
      else if (ts.isJsxExpression(initializer) && initializer.expression) recordRenderedExpression(initializer.expression, node, node.name.getText(source));
    }
    if (ts.isCallExpression(node)) {
      const name = ts.isIdentifier(node.expression) ? node.expression.text : '';
      if (name === 'translateUiText' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) add(node.arguments[0].text, file);
      if (name === 'createLocaleCopies' && node.arguments[0]) {
        const english = findLocale(node.arguments[0], 'en') ?? node.arguments[0];
        const phrases = collectEnglish(english);
        if (findLocale(node.arguments[0], 'ru')) phrases.forEach(phrase => ruOverrides.add(phrase));
      }
      if (name === 'localizeUiCopy' && node.arguments[0]) {
        const phrases = collectEnglish(node.arguments[0]);
        const sourceNames = identifiers(node.arguments[0]);
        const hasRuCopy = sourceNames.some(sourceName => /_EN$/.test(sourceName) && declarations.has(sourceName.replace(/_EN$/, '_RU')));
        if (hasRuCopy || (/_RU\b/.test(node.arguments[0].getText(source)) && /_EN\b/.test(node.arguments[0].getText(source)))) {
          phrases.forEach(phrase => ruOverrides.add(phrase));
        }
      }
      if (localeTextNames.has(name) && node.arguments[0]) {
        const sourceText = literalCopy(node.arguments[0]);
        if (sourceText !== null) {
          add(sourceText, file);
          if (node.arguments[1] && literalCopy(node.arguments[1]) !== null) ruOverrides.add(sourceText);
        }
      } else if (i18nTNames.has(name) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const key = node.arguments[0].text;
        const resolved = resolveKey(key);
        if (typeof resolved === 'string') add(resolved, file, key);
        else if (!key.includes('{') && !key.includes('}') && !key.includes('${')) unresolvedKeys.set(key, [...(unresolvedKeys.get(key) ?? []), path.relative(sourceRoot, file)]);
        if (node.arguments[1] && ts.isStringLiteral(node.arguments[1])) ruOverrides.add(typeof resolved === 'string' ? resolved : key);
      }
      if (ts.isCallExpression(node.expression) && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'localeText' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        add(node.arguments[0].text, file);
        if (node.arguments[1] && ts.isStringLiteral(node.arguments[1])) ruOverrides.add(node.arguments[0].text);
      }
      if (name === 'localizedUi' && ts.isObjectLiteralExpression(node.arguments[0])) {
        let enText;
        let hasRu = false;
        for (const property of node.arguments[0].properties) if (ts.isPropertyAssignment(property) && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) {
          if (property.name.text === 'en' && property.initializer && ts.isStringLiteral(property.initializer)) enText = property.initializer.text;
          if (property.name.text === 'ru') hasRu = true;
        }
        if (enText) { add(enText, file); if (hasRu) ruOverrides.add(enText); }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
// Build calculation explanations are localized through `localizedUi` from named topic records.
// They are not call-site literals, so include their authored English keys explicitly in this audit.
const { buildHelpTranslations } = require('../../packages/i18n/src/locales/extra/build/help.ts');
for (const phrase of Object.keys(buildHelpTranslations.de ?? {})) {
  add(phrase, path.resolve('packages/i18n/src/locales/extra/build/help.ts'));
}
const missingByCulture = {};
for (const culture of cultures) {
  const identityCulture = culture === 'zh-Hans' || culture === 'zh-Hans-SG' ? 'zh-CN' : culture;
  const missing = [...used].filter(([source]) => !(culture === 'ru' && ruOverrides.has(source)) && siteUiCorrections[identityCulture]?.[source] !== source && translateUiText(source, culture) === source && !/^[\W\d_]+$/.test(source) && !/^(?:[A-Z0-9]+(?:[ /·+.-][A-Z0-9]+)*)$/.test(source));
  missingByCulture[culture] = missing.map(([source]) => source);
  if (process.argv.includes('--json') || process.argv.includes('--sources')) continue;
  console.log(`\n${culture}: ${missing.length}/${used.size}`);
  if (process.argv.includes('--all')) console.log(missing.map(([source, files]) => `${source}  [${[...new Set(files)].slice(0, 2).join(', ')}]`).join('\n'));
  else console.log(missing.slice(0, 12).map(([source]) => source).join('\n'));
}
const placeholderIssues = [];
const placeholders = value => value.match(/\{\{[^{}]+\}\}|\{[^{}]+\}/g) ?? [];
for (const source of used.keys()) {
  const expected = placeholders(source).sort();
  if (!expected.length) continue;
  for (const culture of cultures) {
    const actual = placeholders(translateUiText(source, culture)).sort();
    if (expected.join('\u0000') !== actual.join('\u0000')) {
      placeholderIssues.push({ source, culture, expected, actual });
    }
  }
}
if (process.argv.includes('--json')) console.log(JSON.stringify(missingByCulture, null, 2));
if (process.argv.includes('--sources')) {
  for (const [source, references] of used) {
    if (process.argv[2] === '--sources' && process.argv[3] && !source.toLowerCase().includes(process.argv[3].toLowerCase())) continue;
    console.log(`${source}\t${[...new Set(references)].slice(0, 4).join(' | ')}`);
  }
}
const richCopyIssues = [];
const jsxCopyFile = path.resolve('apps/web/src/features/datamine/multype/guide/guide-copy.tsx');
const richDataFile = path.resolve('apps/web/src/features/datamine/multype/guide/guide-rich-data.ts');
const parseSource = file => ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const unwrap = node => {
  while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node))) node = node.expression;
  return node;
};
const nameOf = node => node && (ts.isIdentifier(node) || ts.isStringLiteral(node)) ? node.text : '';
const variableInitializer = (source, name) => {
  let initializer;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) initializer = node.initializer;
    if (!initializer) ts.forEachChild(node, visit);
  };
  visit(source);
  return unwrap(initializer);
};
const objectProperty = (object, name) => ts.isObjectLiteralExpression(object)
  ? object.properties.find(property => ts.isPropertyAssignment(property) && nameOf(property.name) === name)
  : undefined;
const jsxSource = parseSource(jsxCopyFile);
const guideSource = unwrap(variableInitializer(jsxSource, 'GUIDE_SOURCE'));
const englishGuide = unwrap(objectProperty(guideSource, 'en')?.initializer);
const hasJsx = node => {
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) return true;
  let found = false;
  ts.forEachChild(node, child => { if (!found) found = hasJsx(child); });
  return found;
};
const richSourceKeys = ts.isObjectLiteralExpression(englishGuide)
  ? englishGuide.properties.filter(property => ts.isPropertyAssignment(property) && hasJsx(property.initializer)).map(property => nameOf(property.name))
  : [];
const russianGuide = unwrap(objectProperty(guideSource, 'ru')?.initializer);
const russianRichKeys = ts.isObjectLiteralExpression(russianGuide)
  ? russianGuide.properties.filter(property => ts.isPropertyAssignment(property) && hasJsx(property.initializer)).map(property => nameOf(property.name))
  : [];
const richDataSource = parseSource(richDataFile);
const richDataObject = unwrap(variableInitializer(richDataSource, 'guideRichText'));
const richMaps = new Map();
if (ts.isObjectLiteralExpression(richDataObject)) {
  for (const cultureProperty of richDataObject.properties) {
    if (!ts.isPropertyAssignment(cultureProperty)) continue;
    const culture = nameOf(cultureProperty.name);
    const values = unwrap(cultureProperty.initializer);
    if (!ts.isObjectLiteralExpression(values)) continue;
    richMaps.set(culture, new Map(values.properties.filter(property => ts.isPropertyAssignment(property)).map(property => [nameOf(property.name), unwrap(property.initializer)?.text])));
  }
}
for (const culture of cultures) {
  if (culture === 'ru') {
    for (const key of richSourceKeys) if (!russianRichKeys.includes(key)) richCopyIssues.push(`ru: missing explicit Russian rich guide copy ${key}`);
    continue;
  }
  const mapCulture = culture.startsWith('zh-') ? culture : culture;
  const localized = richMaps.get(mapCulture);
  if (!localized) {
    richCopyIssues.push(`${culture}: missing rich guide map`);
    continue;
  }
  for (const key of richSourceKeys) if (!localized.get(key)?.trim()) richCopyIssues.push(`${culture}: missing rich guide copy ${key}`);
  for (const key of localized.keys()) if (!richSourceKeys.includes(key)) richCopyIssues.push(`${culture}: orphan rich guide copy ${key}`);
}
for (const alias of ['zh-Hans', 'zh-Hans-SG']) {
  const target = richMaps.get(alias);
  const source = richMaps.get('zh-CN');
  if (target?.size !== source?.size || [...(source ?? new Map()).keys()].some(key => target?.get(key) !== source.get(key))) {
    richCopyIssues.push(`${alias}: rich guide entries must match zh-CN`);
  }
}
const missingCount = Object.values(missingByCulture).reduce((sum, missing) => sum + missing.length, 0);
if (placeholderIssues.length) {
  console.error(`\nUI localization changed placeholders in ${placeholderIssues.length} phrase/culture pairs:`);
  for (const issue of placeholderIssues) console.error(`${issue.culture}: ${issue.source} -> [${issue.actual.join(', ')}], expected [${issue.expected.join(', ')}]`);
}
if (rawTranslatedUi.length) {
  console.error(`\nUI literals have translations but bypass the localization API (${rawTranslatedUi.length}):`);
  for (const issue of rawTranslatedUi) console.error(`${issue.file}:${issue.line} [${issue.kind}] ${issue.phrase}`);
}
if (rawMissingUi.length) {
  console.error(`\nUnlocalized natural-language JSX copy must use the localization catalog or have a reviewed identity entry (${rawMissingUi.length}):`);
  for (const issue of rawMissingUi) console.error(`${issue.file}:${issue.line} [${issue.kind}] ${issue.phrase}`);
}
if (richCopyIssues.length) {
  console.error(`\nRich guide localization is incomplete (${richCopyIssues.length}):`);
  for (const issue of richCopyIssues) console.error(issue);
}
if (dynamicUiLabelIssues.length) {
  console.error(`\nDynamic UI labels have incomplete Russian values (${dynamicUiLabelIssues.length}):`);
  for (const issue of dynamicUiLabelIssues) console.error(issue);
}
if (missingCount || placeholderIssues.length || rawTranslatedUi.length || rawMissingUi.length || richCopyIssues.length || dynamicUiLabelIssues.length) {
  console.error(`\nUI localization incomplete: ${missingCount} untranslated phrase/culture pairs across ${used.size} source phrases.`);
  process.exitCode = 1;
} else if (!process.argv.includes('--json') && !process.argv.includes('--sources')) {
  console.log(`\nUI localization complete: ${used.size} source phrases covered across ${cultures.length} cultures.`);
}
