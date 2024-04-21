import fs from 'fs/promises';
// import constant from 'fsPromises/constants'
import path from 'path';
import os from 'os';
import _ from 'lodash';
import nock from 'nock';
// import axios from 'axios'; // for testing

import pageLoader from '../src/pageLoader.js';

const testRootDir = path.join(os.tmpdir(), 'page-loader');
const getFixturePath = (filename) => path.resolve(`__fixtures__/${filename}`);
const testUrl = 'http://www.example.com';
const expectFileName = 'www-example-com.html';
let expectFileData;
let testDir;
let fileData;
nock.disableNetConnect();

beforeAll(async () => {
  await fs.rmdir(testRootDir, { recursive: true }).catch(_.noop);
  await fs.mkdir(testRootDir).catch(_.noop);
  expectFileData = await fs.readFile(getFixturePath('index.html'), 'utf-8');
});

beforeEach(async () => {
  testDir = await fs.mkdtemp(`${testRootDir}/`);
});

test('pageLoader', async () => {
  const scope = nock(testUrl)
    .get('/')
    .reply(200, expectFileData);
  const resultFilePath = await pageLoader(testUrl, testDir);
  expect(resultFilePath).toEqual(path.resolve(testDir, expectFileName));
  expect(scope.isDone()).toBe(true);
  expect(async () => fs.access(resultFilePath, fs.constants.R_OK)).not.toThrow();
  fileData = await fs.readFile(resultFilePath, 'utf-8');
  expect(fileData).toEqual(expectFileData);
});
