// import axios from 'axios';
import path from 'path';
import fs from 'fs/promises';
import * as cheerio from 'cheerio';
import _ from 'lodash';
import Listr from 'listr';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
require('axios-debug-log');

const axios = require('axios');
require('debug');
const debug = require('debug')('page-loader');

const getFileName = (url) => {
  let rawName;
  const fileExt = path.extname(url.pathname) !== '' ? path.extname(url.pathname) : '.html';
  if (url.pathname.length === 1) rawName = `${url.host}`;
  else {
    const filePath = path.dirname(url.pathname);
    const fileName = path.basename(url.pathname).replace(path.extname(url.pathname), '');
    rawName = `${url.host}${filePath}/${fileName}`;
  }
  const regex = /[^A-Za-z0-9]+/g;
  const name = rawName.replace(regex, '-');
  return `${name}${fileExt}`;
};

const parseHTML = (rawData, parser = cheerio) => parser.load(rawData);

const extractAssetsList = ($, extractProperty, mainUrl) => {
  const tags = Object.keys(extractProperty);
  return tags.flatMap((tag) => {
    const links = [];
    $(tag).each(function func(/* i, element */) {
      const link = $(this).attr(extractProperty[tag].attr);
      let url;
      if (link) {
        try {
          url = new URL(link);
        } catch (e) {
          url = new URL(link, mainUrl.origin);
        }
        if (url.host === mainUrl.host) {
          links.push({
            tag,
            link,
            attr: extractProperty[tag].attr,
            url,
            responseType: extractProperty[tag].responseType,
          });
        }
      }
    });
    return links;
  });
};

const download = (assets, isSilent = true) => {
  const tasks = assets.flatMap(({ url, responseType }) => {
    const promise = axios.get(url, {
      responseType,
      validateStatus: (status) => status === 200,
    })
      .then((response) => {
        debug(`${url} downloaded`);
        return {
          status: 'downloaded',
          data: response.data,
          url,
        };
      })
      .catch((e) => {
        debug(`${url} download error: %O`, e);

        if (e.response) {
          throw new Error(`${url}: ${e.response.status}, ${e.response.statusMessage}`);
        } else if (e.request) {
          throw new Error(`This site can’t be reached: "${url}".`);
        } else {
          throw new Error(`Error: ${e.message}`);
        }
        /* return {
          status: 'download error',
          error: e,
          url,
        }; */
      });
    if (isSilent) return promise;
    return {
      title: url.toString(),
      task: (ctx) => promise.then((data) => ctx.push(data)),
    };
  });
  if (isSilent) return Promise.all(tasks);
  const listrTasks = new Listr(tasks, { concurrent: true });
  return listrTasks.run([]).catch((e) => {
    throw new Error(e.message);
  });
};

const save = (assets, output) => {
  const promises = assets.flatMap(({ status, data, relativeFilePath }) => {
    if (status === 'downloaded') {
      return fs.writeFile(path.resolve(output, relativeFilePath), data, 'utf-8')
        .then(() => debug(`${relativeFilePath} is save`))
        .catch((e) => {
          debug(`${relativeFilePath} isn't save %O`, e);
          throw new Error(`Cannot save file ${path.resolve(output, relativeFilePath)}
          ${e.message}`);
        });
    }
    return [];
  });
  return Promise.all(promises);
};

const modifyAssets = ($, assets) => {
  assets.forEach(({ attr, link, relativeFilePath }) => $(`[${attr}=${link}]`).attr(attr, relativeFilePath));
  return $;
};

const makeRelativeFilePaths = (asserts, assetsDir) => asserts
  .map(({ status, url, link }) => ({
    relativeFilePath: status === 'downloaded' ? `${assetsDir}/${getFileName(url)}` : link,
  }));

const pageLoader = (url, output = process.cwd()) => {
  const extractProperty = {
    img:
    {
      attr: 'src',
      responseType: 'arraybuffer',
    },
    link:
    {
      attr: 'href',
      responseType: 'arraybuffer',
    },
    script:
    {
      attr: 'src',
      responseType: 'arraybuffer',
    },
  };

  const mainFile = {
    url: new URL(url),
    responseType: 'arraybuffer',
    isLokal: true,
  };

  mainFile.relativeFilePath = getFileName(mainFile.url);
  mainFile.assetsDir = mainFile.relativeFilePath.replace('.html', '_files');

  let assets;

  return download([mainFile])
    .then((results) => {
      mainFile.data = results[0].data;
      mainFile.error = results[0].error;
      mainFile.status = results[0].status;
      mainFile.resolvedData = parseHTML(mainFile.data);
      debug('main page successfully parsed');
      assets = extractAssetsList(mainFile.resolvedData, extractProperty, mainFile.url);
      debug(`extract ${assets.length} asset links:\n${JSON.stringify(assets, null, 2)}`);
      return download(assets, false);
    })
    .then((results) => {
      assets = assets.map((assset) => ({
        ...assset,
        ...results.find((result) => assset.url === result.url),
      }));
      const relativeFilePaths = makeRelativeFilePaths(assets, mainFile.assetsDir);
      assets = (_.merge(assets, relativeFilePaths));
      mainFile.resolvedData = modifyAssets(mainFile.resolvedData, assets);
      mainFile.data = mainFile.resolvedData.html();
      if (assets.some(({ status }) => status === 'downloaded')) {
        return fs.mkdir(path.resolve(output, mainFile.assetsDir)).then(() => {
          debug(`create assets directory ${mainFile.assetsDir}`);
        }).catch((e) => {
          throw new Error(`Cannot create assets directory ${mainFile.assetsDir}
          ${e.message}`);
        });
      }
      return Promise.resolve();
    })
    .then(() => {
      // console.log(assets);
      save([mainFile, ...assets], output);
    })
    .then(() => `Page was successfully downloaded into ${path.resolve(output, mainFile.relativeFilePath)}`)
    .catch((e) => {
      throw e;
    });
};

export default pageLoader;
