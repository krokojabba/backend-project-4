import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import _ from 'lodash';
import nock from 'nock';
// import axios from 'axios'; // for testing

import pageLoader from '../src/pageLoader.js';

const testRootDir = path.join(os.tmpdir(), 'page-loader');
const testData = [
  {
    name: 'test1',
    url: 'https://ru.hexlet.io/courses',
    expectFuctionResult: 'ru-hexlet-io-courses.html',
  },
  {
    name: 'test2',
    url: 'https://ru.hexlet.io/courses',
    expectFuctionResult: 'ru-hexlet-io-courses.html',
  },
  {
    name: 'test3_bad_assert',
    url: 'https://ru.hexlet.io/courses',
    expectFuctionResult: 'ru-hexlet-io-courses.html',
  },
];
testData[0].files = [
  {
    originalFileName: 'index.html',
    originalDir: '',
    link: '/courses',
    expectFileName: 'ru-hexlet-io-courses.html',
    expectDir: '',
    contentType: 'application/json',
  },
  {
    originalFileName: 'nodejs.jpeg',
    originalDir: 'assets/professions',
    link: '/assets/professions/nodejs.jpeg',
    expectFileName: 'ru-hexlet-io-assets-professions-nodejs.jpeg',
    expectDir: 'ru-hexlet-io-courses_files',
    contentType: 'image/jpeg',
  },
  {
    originalFileName: 'nodejs.png',
    originalDir: 'assets/professions',
    link: '/assets/professions/nodejs.png',
    expectFileName: 'ru-hexlet-io-assets-professions-nodejs.png',
    expectDir: 'ru-hexlet-io-courses_files',
    contentType: 'image/png',
  },
];
testData[1].files = [
  {
    originalFileName: 'index.html',
    originalDir: '',
    link: '/courses',
    expectFileName: 'ru-hexlet-io-courses.html',
    expectDir: '',
    contentType: 'application/json',
  },
  {
    originalFileName: 'nodejs.png',
    originalDir: 'assets/professions',
    link: '/assets/professions/nodejs.png',
    expectFileName: 'ru-hexlet-io-assets-professions-nodejs.png',
    expectDir: 'ru-hexlet-io-courses_files',
    contentType: 'image/png',
  },
  {
    originalFileName: 'application.css',
    originalDir: 'assets',
    link: '/assets/application.css',
    expectFileName: 'ru-hexlet-io-assets-application.css',
    expectDir: 'ru-hexlet-io-courses_files',
    contentType: 'application/json',
  },
  {
    originalFileName: 'index1.html',
    originalDir: 'courses',
    link: '/courses',
    expectFileName: 'ru-hexlet-io-courses.html',
    expectDir: 'ru-hexlet-io-courses_files',
    contentType: 'application/json',
  },
  {
    originalFileName: 'runtime.js',
    originalDir: 'packs/js',
    link: '/packs/js/runtime.js',
    expectFileName: 'ru-hexlet-io-packs-js-runtime.js',
    expectDir: 'ru-hexlet-io-courses_files',
    contentType: 'application/json',
  },
];
testData[2].files = [
  {
    originalFileName: 'index.html',
    originalDir: '',
    link: '/courses',
    expectFileName: 'ru-hexlet-io-courses.html',
    expectDir: '',
    contentType: 'application/json',
  },
  {
    originalFileName: 'nodejs.png',
    originalDir: 'assets/professions',
    link: '/assets/professions/nodejs.png',
    expectFileName: 'ru-hexlet-io-assets-professions-nodejs.png',
    expectDir: 'ru-hexlet-io-courses_files',
    contentType: 'image/png',
    notAvailable: true,
  },
  {
    originalFileName: 'application.css',
    originalDir: 'assets',
    link: '/assets/application.css',
    expectFileName: 'ru-hexlet-io-assets-application.css',
    expectDir: 'ru-hexlet-io-courses_files',
    contentType: 'application/json',
  },
  {
    originalFileName: 'index1.html',
    originalDir: 'courses',
    link: '/courses',
    expectFileName: 'ru-hexlet-io-courses.html',
    expectDir: 'ru-hexlet-io-courses_files',
    contentType: 'application/json',
  },
  {
    originalFileName: 'runtime.js',
    originalDir: 'packs/js',
    link: '/packs/js/runtime.js',
    expectFileName: 'ru-hexlet-io-packs-js-runtime.js',
    expectDir: 'ru-hexlet-io-courses_files',
    contentType: 'application/json',
  },
];
let resultFilePath;
const testDir = {};
const scopes = {};
const fuctionResult = {};

beforeAll(async () => {
  await fs.rmdir(testRootDir, { recursive: true }).catch(_.noop);
  await fs.mkdir(testRootDir).catch(_.noop);
  nock.disableNetConnect();
});

describe.each(testData)('$name', ({
  name,
  url,
  expectFuctionResult,
  files,
}) => {
  beforeAll(async () => {
    testDir[name] = await fs.mkdtemp(`${testRootDir}/`);
    const resolvedUrl = new URL(url);
    scopes[name] = [];
    files.forEach(({
      originalFileName,
      originalDir,
      link,
      notAvailable,
    }) => {
      if (!notAvailable) {
        scopes[name].push(nock(`${resolvedUrl.origin}`)
          .get(link)
          .replyWithFile(200, path.resolve('__fixtures__', name, 'original', originalDir, originalFileName)));
      }
    });
    fuctionResult[name] = await pageLoader(url, testDir[name]);
  });

  afterAll(() => {
    nock.cleanAll();
  });

  test('fuction result', () => {
    expect(fuctionResult[name]).toEqual(`Page was successfully downloaded into ${path.resolve(testDir[name], expectFuctionResult)}`);
  });

  test('scope', () => {
    expect(scopes[name].every((scope) => scope.isDone())).toBe(true);
  });

  describe.each(files)('test file $originalFileName', ({ expectFileName, expectDir, notAvailable }) => {
    beforeAll(() => {
      resultFilePath = path.resolve(testDir[name], expectDir, expectFileName);
    });

    if (!notAvailable) {
      test('file exist', async () => {
        const isExist = await fs.access(resultFilePath, fs.constants.R_OK)
          .then(() => true)
          .catch(() => false);
        expect(isExist || notAvailable).toBeTruthy();
      });
      test('equal data', async () => {
        const modifiedFilePath = path.resolve('__fixtures__', name, 'modified', expectDir, expectFileName);
        const resultData = await fs.readFile(resultFilePath, 'utf-8');
        const expectData = await fs.readFile(modifiedFilePath, 'utf-8');
        expect(resultData.replace(/\s/g, '')).toEqual(expectData.replace(/\s/g, ''));
      });
    } else {
      test('file not exist', async () => {
        const isExist = await fs.access(resultFilePath, fs.constants.R_OK)
          .then(() => true)
          .catch(() => false);
        expect(isExist).toBeFalsy();
      });
    }
  });
});
