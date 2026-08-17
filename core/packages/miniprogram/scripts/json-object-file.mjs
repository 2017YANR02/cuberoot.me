import { readFile } from 'node:fs/promises';

export class JsonObjectFileError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'JsonObjectFileError';
  }
}

export async function readJsonObjectFile(path, options = {}) {
  const label = options.label ?? path;
  let source;

  try {
    source = await readFile(path, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT' && Object.hasOwn(options, 'missingValue')) {
      return options.missingValue;
    }
    throw new JsonObjectFileError(`${label} 无法读取。`, { cause: error });
  }

  let value;
  try {
    value = JSON.parse(source);
  } catch (error) {
    throw new JsonObjectFileError(`${label} 不是有效的 JSON。`, { cause: error });
  }

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new JsonObjectFileError(`${label} 的顶层必须是 JSON 对象。`);
  }

  return value;
}
