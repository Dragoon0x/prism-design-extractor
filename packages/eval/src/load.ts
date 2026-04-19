/**
 * Fixture loader. Walks `fixtures/images/` for `.png` / `.jpg` / `.webp`
 * files, looks up the matching `fixtures/answers/<id>.json`, and yields
 * `{ id, imageBytes, answer }` tuples.
 */
import { readdir, readFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { answerFileSchema, type AnswerFile } from './answer-schema.js';

export interface FixtureBundle {
  id: string;
  imagePath: string;
  imageBytes: Buffer;
  answer: AnswerFile;
}

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);

export async function loadFixtures(fixturesRoot: string): Promise<FixtureBundle[]> {
  const imagesDir = join(fixturesRoot, 'images');
  const answersDir = join(fixturesRoot, 'answers');

  let entries: string[];
  try {
    entries = await readdir(imagesDir);
  } catch (err) {
    throw new Error(
      `Could not read fixtures/images/ at ${imagesDir}: ${(err as Error).message}`,
    );
  }

  const bundles: FixtureBundle[] = [];
  for (const entry of entries) {
    const ext = extname(entry).toLowerCase();
    if (!IMAGE_EXT.has(ext)) continue;
    const id = basename(entry, ext);
    const imagePath = join(imagesDir, entry);
    let answer: AnswerFile;
    try {
      const raw = await readFile(join(answersDir, `${id}.json`), 'utf8');
      answer = answerFileSchema.parse(JSON.parse(raw));
    } catch (err) {
      throw new Error(
        `Fixture "${id}": missing or invalid answer file: ${(err as Error).message}`,
      );
    }
    const imageBytes = await readFile(imagePath);
    bundles.push({ id, imagePath, imageBytes, answer });
  }

  return bundles.sort((a, b) => a.id.localeCompare(b.id));
}
