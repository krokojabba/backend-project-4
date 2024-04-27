import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import _ from 'lodash';
import nock from 'nock';
// import axios from 'axios'; // for testing

import pageLoader from '../src/pageLoader.js';

const testRootDir = path.join(os.tmpdir(), 'page-loader');
const testData = {
  name: 'test1',
  url: 'https://ru.hexlet.io/courses',
  expectFileName: 'ru-hexlet-io-courses.html',
};
testData.files = [
  {
    originalFileName: 'index.html',
    originalDir: '',
    expectFileName: testData.expectFileName,
    expectDir: '',
    contentType: 'application/json',
  },
  {
    originalFileName: 'nodejs.jpeg',
    originalDir: 'assets/professions',
    expectFileName: 'ru-hexlet-io-assets-professions-nodejs.jpeg',
    expectDir: 'ru-hexlet-io-courses_files',
    contentType: 'image/jpeg',
  },
  {
    originalFileName: 'nodejs.png',
    originalDir: 'assets/professions',
    expectFileName: 'ru-hexlet-io-assets-professions-nodejs.png',
    expectDir: 'ru-hexlet-io-courses_files',
    contentType: 'image/png',
  },
];
let resultFilePath;
let testDir;

beforeAll(async () => {
  await fs.rmdir(testRootDir, { recursive: true }).catch(_.noop);
  await fs.mkdir(testRootDir).catch(_.noop);
  nock.disableNetConnect();
});

describe(`${testData.name}`, () => {
  beforeAll(async () => {
    testDir = await fs.mkdtemp(`${testRootDir}/`);
    const resolvedUrl = new URL(testData.url);
    testData.files.forEach(({ originalFileName, originalDir }, i) => {
      testData.files[i].scope = nock(`${resolvedUrl.origin}`)
        .get(originalDir === '' ? resolvedUrl.pathname : `/${originalDir}/${originalFileName}`)
        .replyWithFile(200, path.resolve('__fixtures__', testData.name, 'original', originalDir, originalFileName));
    });
    testData.fuctionResult = await pageLoader(testData.url, testDir);
  });

  test('fuction result', () => {
    expect(testData.fuctionResult).toEqual(path.resolve(testDir, testData.expectFileName));
  });

  test('scope', () => {
    expect(testData.files.every(({ scope }) => scope.isDone())).toBe(true);
  });

  describe.each(testData.files)('test file $originalFileName', ({ expectFileName, expectDir }) => {
    beforeAll(() => {
      resultFilePath = path.resolve(testDir, expectDir, expectFileName);
    });

    test('file exist', async () => {
      const isExist = await fs.access(resultFilePath, fs.constants.R_OK)
        .then(() => true)
        .catch(() => false);
      expect(isExist).toBeTruthy();
    });

    test('equal data', async () => {
      const modifiedFilePath = path.resolve('__fixtures__', testData.name, 'modified', expectDir, expectFileName);
      const resultData = await fs.readFile(resultFilePath, 'utf-8');
      const expectData = await fs.readFile(modifiedFilePath, 'utf-8');
      expect(resultData.replace(/\s/g, '')).toEqual(expectData.replace(/\s/g, ''));
    });
  });
});
