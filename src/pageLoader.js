import axios from 'axios';
import path from 'path';
import fs from 'fs/promises';
import * as cheerio from 'cheerio';
import _ from 'lodash';
import Listr from 'listr';

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

const extractAssetsList = ($, extractProperty) => {
  const tags = Object.keys(extractProperty);
  return tags.flatMap((tag) => {
    const links = [];
    $(tag).each(function func(/* i, element */) {
      links.push({
        tag,
        link: $(this).attr(extractProperty[tag].attr),
        attr: extractProperty[tag].attr,
        responseType: extractProperty[tag].responseType,
      });
    });
    return links;
  });
};

const download = (assets, isSilent = true) => {
  const tasks = assets.flatMap(({ url, responseType, isLokal }) => {
    if (!isLokal) return [];
    const promise = axios.get(url, { responseType })
      .then((response) => ({
        status: 'downloaded',
        data: response.data,
        url,
      }))
      .catch((e) => ({
        status: 'download error',
        error: e,
        url,
      }));
    if (isSilent) return promise;
    return {
      title: url.toString(),
      task: (ctx) => promise.then((data) => ctx.push(data)),
    };
  });
  if (isSilent) return Promise.all(tasks);
  const listrTasks = new Listr(tasks, { concurrent: true });
  return listrTasks.run([]);
};

const save = (assets, output) => {
  const promises = assets.flatMap(({ status, data, relativeFilePath }) => {
    if (status === 'downloaded') return fs.writeFile(path.resolve(output, relativeFilePath), data);
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

const pageLoader = (url, output) => {
  const extractProperty = {
    img:
    {
      attr: 'src',
      responseType: 'arraybuffer',
    },
    link:
    {
      attr: 'href',
      responseType: 'document',
    },
    script:
    {
      attr: 'src',
      responseType: 'document',
    },
  };

  const mainFile = {
    url: new URL(url),
    responseType: 'document',
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
      const assetLinks = extractAssetsList(mainFile.resolvedData, extractProperty);
      // console.log(assetLinks);
      const assetUrls = assetLinks
        .map(({ link: assetLink }) => {
          try {
            return {
              url: new URL(assetLink),
              isLokal: new URL(assetLink).host === mainFile.url.host,
            };
          } catch (e) {
            return {
              url: new URL(assetLink, mainFile.url.origin),
              isLokal: true,
            };
          }
        });
      assets = (_.merge(assetLinks, assetUrls));
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
      if (assets.some(({ status }) => status === 'downloaded')) return fs.mkdir(path.resolve(output, mainFile.assetsDir));
      return Promise.resolve();
    })
    .then(() => {
      // console.log(assets);
      save([mainFile, ...assets], output);
    })
    .then(() => `Page was successfully downloaded into ${path.resolve(output, mainFile.relativeFilePath)}`);
};

export default pageLoader;
