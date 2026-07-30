const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const translations = JSON.parse(
    fs.readFileSync(path.join(root, 'lang', 'translations.json'), 'utf8')
);

function flatten(value, prefix = '', result = {}) {
    for (const [key, child] of Object.entries(value)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (child && typeof child === 'object' && !Array.isArray(child)) {
            flatten(child, fullKey, result);
        } else {
            result[fullKey] = child;
        }
    }
    return result;
}

const keyPattern = /data-i18n(?:-placeholder)?="([^"]+)"/g;
const requiredKeys = new Set(Array.from(html.matchAll(keyPattern), match => match[1]));
const runtimeKeyPattern = /getTranslation\('([^']+)'/g;
for (const match of html.matchAll(runtimeKeyPattern)) {
    requiredKeys.add(match[1]);
}
const failures = [];
const flattenedTranslations = Object.fromEntries(
    Object.entries(translations).map(([language, values]) => [language, flatten(values)])
);
const referenceKeys = new Set(Object.keys(flattenedTranslations.ko));

for (const [language, flattened] of Object.entries(flattenedTranslations)) {
    for (const key of referenceKeys) {
        if (!(key in flattened)) {
            failures.push(`${language}: missing locale key ${key}`);
        }
    }

    for (const key of Object.keys(flattened)) {
        if (!referenceKeys.has(key)) {
            failures.push(`${language}: unexpected locale key ${key}`);
        }
    }

    for (const key of requiredKeys) {
        if (typeof flattened[key] !== 'string' || !flattened[key].trim()) {
            failures.push(`${language}: missing ${key}`);
        }
    }

    if (language !== 'ko') {
        for (const key of requiredKeys) {
            if (/[가-힣]/.test(flattened[key] || '')) {
                failures.push(`${language}: Korean text remains in ${key}`);
            }
        }
    }
}

if (failures.length) {
    console.error(failures.join('\n'));
    process.exit(1);
}

console.log(`${requiredKeys.size} homepage translation keys verified across ${Object.keys(translations).length} languages.`);
