#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT_DIR = resolve(SCRIPT_DIR, '../../data/sq1-pbl');
const EXPECTED_JAR_SHA256 =
  'dec27e3b9879a64b39168a4152c6d39b78af41cd68d8abb41be5a96d3b032d11';

const EXPECTED_GOLDEN = {
  solutionCount: 125,
  setup: {
    top: '1,0/0,-3/-1,0/3,0/1,0/0,3/-1,0/-3,0/',
    bottom:
      '1,-1/-6,-6/1,0/0,-3/-1,0/3,0/1,0/0,3/-1,0/-3,0/1,-1/-6,-6/',
  },
  firstResults: [
    {
      sequence: '4,-3/5,-1/-3,0/1,1/-3,0/-1,0',
      auxiliaryAlgorithms: ['nothing', 'U+/U-7'],
      stm: 5,
      ftm: 14,
    },
    {
      sequence: '-3,-4/-3,0/-5,-5/0,-3/-1,5/0,1',
      auxiliaryAlgorithms: ['J/L7', 'T/T1'],
      stm: 5,
      ftm: 14,
    },
    {
      sequence: '4,-3/5,-1/-3,0/1,1/-3,0/-1,0/',
      auxiliaryAlgorithms: ['U+/U-7', 'nothing'],
      stm: 6,
      ftm: 15,
    },
  ],
};

const JAVA_HELPER = String.raw`
import java.lang.reflect.Array;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;

public class FinderJarExport {
  private static String encode(Object value) {
    return Base64.getEncoder().encodeToString(
      String.valueOf(value).getBytes(StandardCharsets.UTF_8)
    );
  }

  private static void emit(String type, Object... values) {
    StringBuilder line = new StringBuilder(type);
    for (Object value : values) {
      line.append('\t').append(encode(value));
    }
    System.out.println(line);
  }

  private static Object call(Method method, Object target) {
    try {
      return method.invoke(target);
    } catch (ReflectiveOperationException error) {
      throw new IllegalStateException(error);
    }
  }

  private static int callInt(Method method, Object target) {
    return ((Number) call(method, target)).intValue();
  }

  private static void emitPlls(
      String group,
      List<?> plls,
      Method getName,
      Method getSequence,
      Method isParity,
      Method sequenceAtBottom,
      Method reverseSequence,
      Method optimizeSequence) throws Exception {
    for (Object pll : plls) {
      String name = String.valueOf(call(getName, pll));
      String sourceSequence = String.valueOf(call(getSequence, pll));
      String topSetup = String.valueOf(
        optimizeSequence.invoke(null, reverseSequence.invoke(null, sourceSequence))
      );
      String bottomSetup = String.valueOf(
        optimizeSequence.invoke(
          null,
          reverseSequence.invoke(null, call(sequenceAtBottom, pll))
        )
      );
      emit(
        "PLL",
        group,
        name,
        sourceSequence,
        call(isParity, pll),
        topSetup,
        bottomSetup
      );
    }
  }

  public static void main(String[] args) throws Exception {
    Class<?> templatesClass = Class.forName("com.main.pbl.AlgTemplates");
    List<?> standardPlls = (List<?>) templatesClass.getField("STANDARD_PLLs").get(null);
    List<?> parityPlls = (List<?>) templatesClass.getField("PARITY_PLLs").get(null);
    Object rawAuxiliaryAlgorithms = templatesClass.getField("AUX_ALGS").get(null);
    List<?> auxiliaryAlgorithms = (List<?>) rawAuxiliaryAlgorithms;

    // Finder reloads this file and removes ASCII spaces. Creating it in the isolated
    // working directory reproduces the first-run desktop behavior without touching
    // the user's real auxiliary-algorithm table.
    Class<?> mainClass = Class.forName("com.main.pbl.Main");
    mainClass
      .getMethod("auxAlgsToFile", ArrayList.class)
      .invoke(null, rawAuxiliaryAlgorithms);

    Class<?> pllClass = Class.forName("com.main.pbl.PLL");
    Class<?> pblClass = Class.forName("com.main.pbl.PBL");
    Class<?> finderClass = Class.forName("com.main.pbl.Finder");
    Class<?> stringUtilsClass = Class.forName("com.main.pbl.CustomStringUtils");
    Method getPllName = pllClass.getMethod("getName");
    Method getPllSequence = pllClass.getMethod("getSequence");
    Method isParity = pllClass.getMethod("isParityPLL");
    Method sequenceAtBottom = pllClass.getMethod("sequenceAtBottom");
    Method reverseSequence = stringUtilsClass.getMethod("reversedSequence", String.class);
    Method optimizeSequence = stringUtilsClass.getMethod("otimizedSequence", String.class);
    emitPlls(
      "standard", standardPlls, getPllName, getPllSequence, isParity,
      sequenceAtBottom, reverseSequence, optimizeSequence
    );
    emitPlls(
      "parity", parityPlls, getPllName, getPllSequence, isParity,
      sequenceAtBottom, reverseSequence, optimizeSequence
    );

    Class<?> auxiliaryAlgorithmClass = Class.forName("com.main.pbl.AuxAlg");
    Method getAuxiliaryName = auxiliaryAlgorithmClass.getMethod("getName");
    Method getAuxiliarySequence = auxiliaryAlgorithmClass.getMethod("getSequence");
    for (Object auxiliaryAlgorithm : auxiliaryAlgorithms) {
      emit(
        "AUX",
        call(getAuxiliaryName, auxiliaryAlgorithm),
        call(getAuxiliarySequence, auxiliaryAlgorithm)
      );
    }

    Method getPllByName = templatesClass.getMethod("getPllByName", String.class);
    Object topUa = getPllByName.invoke(null, "Ua");
    Object bottomUa = getPllByName.invoke(null, "Ua");

    Object pbl = pblClass
      .getConstructor(String.class, pllClass, pllClass)
      .newInstance("Ua/Ua", topUa, bottomUa);

    Object finder = finderClass.getConstructor(pblClass).newInstance(pbl);
    finderClass.getMethod("search").invoke(finder);

    String setups = String.valueOf(finderClass.getMethod("getSetups").invoke(finder));
    emit("SETUPS", setups);

    List<?> rawResults = (List<?>) finderClass.getMethod("getSucessSearches").invoke(finder);
    List<Object> results = new ArrayList<Object>();
    results.addAll(rawResults);

    Class<?> solutionClass = Class.forName("com.main.pbl.SucessSearch");
    Method getSequence = solutionClass.getMethod("getSequence");
    Method getAuxiliaryAlgorithms = solutionClass.getMethod("getAuxAlgs");
    Method getStm = solutionClass.getMethod("getSequenceTwistMetricLenght");
    Method getFtm = solutionClass.getMethod("getFaceTurnMetricLenght");

    // Collections/List sorting is stable. This matches the legacy GUI's ascending
    // twist-metric sort while preserving Finder iteration order for ties.
    results.sort(new Comparator<Object>() {
      @Override
      public int compare(Object left, Object right) {
        return Integer.compare(callInt(getStm, left), callInt(getStm, right));
      }
    });

    emit("COUNT", "solutions", results.size());
    for (int index = 0; index < results.size(); index += 1) {
      Object result = results.get(index);
      Object auxArray = call(getAuxiliaryAlgorithms, result);
      Object firstAux = Array.get(auxArray, 0);
      Object secondAux = Array.get(auxArray, 1);
      emit(
        "RESULT",
        call(getSequence, result),
        call(getAuxiliaryName, firstAux),
        call(getAuxiliaryName, secondAux),
        callInt(getStm, result),
        callInt(getFtm, result),
        result.toString()
      );
    }
  }
}
`;

function fail(message) {
  throw new Error(message);
}

function parseArguments(argv) {
  let jarPath = null;
  let outputDir = DEFAULT_OUTPUT_DIR;
  let check = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--jar') {
      jarPath = argv[index + 1] ?? fail('--jar requires a path');
      index += 1;
    } else if (argument === '--out-dir') {
      outputDir = argv[index + 1] ?? fail('--out-dir requires a path');
      index += 1;
    } else if (argument === '--check') {
      check = true;
    } else if (argument === '--help' || argument === '-h') {
      console.log(
        'Usage: node export-finder-jar.mjs --jar <Square-1 PBL Finder.jar> [--out-dir <dir>] [--check]',
      );
      process.exit(0);
    } else {
      fail(`Unknown argument: ${argument}`);
    }
  }

  if (!jarPath) {
    fail('--jar is required; pass the Square-1 PBL Finder JAR explicitly');
  }

  return {
    jarPath: resolve(jarPath),
    outputDir: resolve(outputDir),
    check,
  };
}

function resolveJavaCommand() {
  if (process.env.SQ1_PBL_JAVA) {
    return process.env.SQ1_PBL_JAVA;
  }

  if (process.env.JAVA_HOME) {
    const executable = process.platform === 'win32' ? 'java.exe' : 'java';
    const candidate = join(process.env.JAVA_HOME, 'bin', executable);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return 'java';
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function decodeField(field) {
  return Buffer.from(field, 'base64').toString('utf8');
}

function parseHelperOutput(stdout) {
  const plls = { standard: [], parity: [] };
  const auxiliaryAlgorithms = [];
  const results = [];
  let setupsText = null;
  let solutionCount = null;

  for (const line of stdout.split(/\r?\n/u)) {
    if (!line) continue;
    const [type, ...encodedFields] = line.split('\t');
    const fields = encodedFields.map(decodeField);

    if (type === 'PLL') {
      const [group, name, sequence, parity, topSetup, bottomSetup] = fields;
      if (!(group in plls)) fail(`Unexpected PLL group: ${group}`);
      plls[group].push({
        name,
        parity: parity === 'true',
        topSetup,
        bottomSetup,
        sourceSequence: sequence,
      });
    } else if (type === 'AUX') {
      const [name, sequence] = fields;
      auxiliaryAlgorithms.push({ name, sequence });
    } else if (type === 'SETUPS') {
      [setupsText] = fields;
    } else if (type === 'COUNT') {
      const [kind, count] = fields;
      if (kind !== 'solutions') fail(`Unexpected count kind: ${kind}`);
      solutionCount = Number.parseInt(count, 10);
    } else if (type === 'RESULT') {
      const [sequence, firstAux, secondAux, stm, ftm, legacyDisplay] = fields;
      results.push({
        sequence,
        auxiliaryAlgorithms: [firstAux, secondAux],
        stm: Number.parseInt(stm, 10),
        ftm: Number.parseInt(ftm, 10),
        legacyDisplay,
      });
    } else {
      fail(`Unexpected helper record: ${type}`);
    }
  }

  if (!setupsText) fail('The helper did not return the Ua/Ua setups');
  if (solutionCount === null) fail('The helper did not return the Ua/Ua result count');

  const setupMatch = setupsText.match(
    /Applied setups:\r?\n([^\r\n]+);\r?\n([^\r\n]+);/u,
  );
  if (!setupMatch) fail(`Could not parse Ua/Ua setups: ${JSON.stringify(setupsText)}`);

  return {
    plls,
    auxiliaryAlgorithms,
    golden: {
      setup: { top: setupMatch[1], bottom: setupMatch[2] },
      solutionCount,
      firstResults: results,
    },
  };
}

function runReflectionExport(jarPath) {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'sq1-pbl-finder-export-'));
  const helperPath = join(temporaryRoot, 'FinderJarExport.java');
  writeFileSync(helperPath, JAVA_HELPER, 'utf8');

  try {
    const processResult = spawnSync(
      resolveJavaCommand(),
      ['--class-path', jarPath, helperPath],
      {
        cwd: temporaryRoot,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
      },
    );

    if (processResult.error) {
      fail(`Could not start Java: ${processResult.error.message}`);
    }
    if (processResult.status !== 0) {
      fail(
        `Reflection helper exited ${processResult.status}: ${processResult.stderr.trim()}`,
      );
    }

    return parseHelperOutput(processResult.stdout);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function normalizeAuxiliaryAlgorithm(rawAlgorithm) {
  const name = rawAlgorithm.name.replaceAll(' ', '');
  const sequence = rawAlgorithm.sequence.replaceAll(' ', '');
  const normalized = { name, sequence };

  if (rawAlgorithm.name !== name) normalized.sourceName = rawAlgorithm.name;
  if (rawAlgorithm.sequence !== sequence) {
    normalized.sourceSequence = rawAlgorithm.sequence;
  }

  return normalized;
}

function isValidSq1Sequence(sequence) {
  return sequence
    .split('/')
    .filter(Boolean)
    .every((turn) => /^-?\d+,-?\d+$/u.test(turn));
}

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(
      `${label} mismatch\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`,
    );
  }
}

function validateExport(exported, jarDigest) {
  if (jarDigest !== EXPECTED_JAR_SHA256) {
    fail(
      `Unexpected JAR SHA-256 ${jarDigest}; expected ${EXPECTED_JAR_SHA256}. ` +
        'Audit the new binary before updating this snapshot.',
    );
  }

  assertEqual(exported.plls.standard.length, 21, 'standard PLL count');
  assertEqual(exported.plls.parity.length, 22, 'parity PLL count');
  assertEqual(exported.auxiliaryAlgorithms.length, 814, 'auxiliary algorithm count');

  for (const [group, groupPlls] of Object.entries(exported.plls)) {
    assertEqual(new Set(groupPlls.map((pll) => pll.name)).size, groupPlls.length, `${group} PLL names`);
    const expectedParity = group === 'parity';
    if (groupPlls.some((pll) => pll.parity !== expectedParity)) {
      fail(`${group} contains an inconsistent parity flag`);
    }
    if (
      groupPlls.some(
        (pll) =>
          !isValidSq1Sequence(pll.sourceSequence) ||
          !isValidSq1Sequence(pll.topSetup) ||
          !isValidSq1Sequence(pll.bottomSetup),
      )
    ) {
      fail(`${group} contains an invalid Square-1 source sequence or setup`);
    }
  }

  const normalizedAuxiliaryAlgorithms = exported.auxiliaryAlgorithms.map(
    normalizeAuxiliaryAlgorithm,
  );
  assertEqual(
    new Set(normalizedAuxiliaryAlgorithms.map((algorithm) => algorithm.name)).size,
    814,
    'unique auxiliary names',
  );
  assertEqual(
    new Set(normalizedAuxiliaryAlgorithms.map((algorithm) => algorithm.sequence)).size,
    814,
    'unique auxiliary sequences',
  );
  if (
    normalizedAuxiliaryAlgorithms.some(
      (algorithm) =>
        !algorithm.name || !isValidSq1Sequence(algorithm.sequence),
    )
  ) {
    fail('An auxiliary algorithm has an empty name or invalid Square-1 sequence');
  }

  assertEqual(exported.golden.solutionCount, EXPECTED_GOLDEN.solutionCount, 'Ua/Ua solution count');
  assertEqual(exported.golden.setup, EXPECTED_GOLDEN.setup, 'Ua/Ua setup');
  assertEqual(
    exported.golden.firstResults.slice(0, 3).map(({ legacyDisplay: _legacyDisplay, ...result }) => result),
    EXPECTED_GOLDEN.firstResults,
    'Ua/Ua first results',
  );

  return normalizedAuxiliaryAlgorithms;
}

function createMetadata(jarDigest) {
  return {
    sourceType: 'binary-jar-reflection-export',
    sourceFileName: 'Square-1 PBL Finder.jar',
    sourceUrl:
      'https://www.dropbox.com/scl/fi/b47zgzc2z8w8w818pzi1m/Square-1-PBL-Finder.jar?rlkey=rxnjgdf319zpq1ubr4bkrddab&e=2&dl=0',
    sourceSha256: jarDigest,
    application: 'Square-1 PBL Finder v1.2',
    authors: ['Anuar Onofre', 'Lucas Sousa'],
    ideaCredit: 'Jayden McNeill',
    auxiliaryDataCredit: {
      name: 'Charlie Stark',
      description: "Most algorithms are identified by the desktop app as coming from Charlie Stark's Sub 6 PBL list.",
      sourceUrl:
        'https://docs.google.com/spreadsheets/d/14ArIWNQCALYqTlWPiYqrO1qKVG09onkngAUYHcnIqfY/edit#gid=0',
    },
    exportMethod:
      'Public runtime fields and methods were read by reflection; Finder output was captured by black-box execution. No decompiled source is included.',
    normalization:
      'ASCII spaces are removed from auxiliary names and sequences, matching the desktop app first-run file reload behavior. Differing raw values are retained as sourceName/sourceSequence.',
  };
}

function createLicenseStatus() {
  return {
    status: 'no-license-found',
    redistributionPermission: 'not-established',
    notice:
      'No source-code or data license was found in the audited JAR or its linked public pages. This provenance record is not an open-source or redistribution-permission claim.',
  };
}

function createDocuments(exported, auxiliaryAlgorithms, jarDigest) {
  const invariants = {
    standardPllCount: 21,
    parityPllCount: 22,
    uniqueStandardPllNames: 21,
    uniqueParityPllNames: 22,
    auxiliaryAlgorithmCount: 814,
    uniqueAuxiliaryNames: 814,
    uniqueAuxiliarySequences: 814,
  };

  const defaults = {
    schemaVersion: 1,
    provenance: createMetadata(jarDigest),
    licenseStatus: createLicenseStatus(),
    invariants,
    plls: exported.plls,
    auxiliaryAlgorithms,
  };

  const golden = {
    schemaVersion: 1,
    provenance: createMetadata(jarDigest),
    licenseStatus: createLicenseStatus(),
    fixture: {
      name: 'Ua/Ua',
      topPll: 'Ua',
      bottomPll: 'Ua',
      auxiliaryAlgorithmCount: 814,
      orderedCandidateCount: 814 * 814,
      ordering:
        'Stable ascending legacy STM; equal-STM results retain Finder iteration order.',
      targetSetup: exported.golden.setup,
      expectedSolutionCount: exported.golden.solutionCount,
      firstResults: exported.golden.firstResults.slice(0, 3),
      expectedResults: exported.golden.firstResults,
    },
  };

  return { defaults, golden };
}

function serialize(document) {
  return `${JSON.stringify(document, null, 2)}\n`;
}

function writeOrCheck(path, document, check) {
  const expected = serialize(document);
  if (check) {
    if (!existsSync(path)) fail(`Missing generated file: ${path}`);
    const actual = readFileSync(path, 'utf8');
    if (actual !== expected) fail(`Generated file is stale: ${path}`);
    return;
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, expected, 'utf8');
}

function main() {
  const { jarPath, outputDir, check } = parseArguments(process.argv.slice(2));
  if (!existsSync(jarPath)) fail(`JAR not found: ${jarPath}`);

  const jarDigest = sha256(jarPath);
  const exported = runReflectionExport(jarPath);
  const auxiliaryAlgorithms = validateExport(exported, jarDigest);
  const documents = createDocuments(exported, auxiliaryAlgorithms, jarDigest);

  writeOrCheck(join(outputDir, 'finder-defaults.json'), documents.defaults, check);
  writeOrCheck(join(outputDir, 'finder-golden.json'), documents.golden, check);

  console.log(
    `${check ? 'Verified' : 'Generated'} SQ1 PBL Finder snapshot: ` +
      `${documents.defaults.plls.standard.length} standard PLLs, ` +
      `${documents.defaults.plls.parity.length} parity PLLs, ` +
      `${documents.defaults.auxiliaryAlgorithms.length} unique auxiliary algorithms, ` +
      `${documents.golden.fixture.expectedSolutionCount} Ua/Ua results.`,
  );
  console.log(`JAR SHA-256: ${jarDigest}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
