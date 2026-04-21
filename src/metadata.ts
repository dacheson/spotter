import packageMetadata from '../package.json' with { type: 'json' };

export const projectName = 'spotter';
export const packageName = packageMetadata.name;
export const packageVersion = packageMetadata.version;