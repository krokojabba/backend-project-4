import axios from 'axios';
import path from 'path';
import fs from 'fs/promises';
import * as cheerio from 'cheerio';
import _ from 'lodash';

const getFileName = (host, pathname, fileName, extention) => {
  const rawName = `${host}${pathname.length === 1 ? '' : pathname}${fileName.length === 0 ? '' : '/'}${fileName}`;
  const regex = /[^A-Za-z0-9]+/g;
  const name = rawName.replace(regex, '-');
  return `${name}${extention}`;
};

const extractProperty = {
  img:
  {
    attr: 'src',
    responseType: 'arraybuffer',
    getNewValue: (host, srcOld, assetsDir) => `${assetsDir}/${getFileName(host, path.dirname(srcOld), path.basename(srcOld).replace(path.extname(srcOld), ''), path.extname(srcOld))}`,
    onError: '',
  },
  main:
  {
    attr: '',
    responseType: 'document',
    getNewValue: () => '',
    onError: '',
  },
};

const createAxiosInstance = (resolvedUrl) => axios.create({
  baseURL: resolvedUrl.origin,
});

const parseHTML = (rawData, parser = cheerio) => parser.load(rawData);

const extractAssetsList = ($, tags = ['img']) => tags
  .flatMap((tag) => {
    const links = [];
    $(tag).each(function func(/* i, element */) {
      links.push({
        tag,
        link: $(this).attr(extractProperty[tag].attr),
        attr: extractProperty[tag].attr,
      });
    });
    return links;
  });

const download = (axiosInstance, links) => {
  const promises = links.map(({ tag, link }) => axiosInstance.get(link, {
    responseType: extractProperty[tag].responseType,
  }).then((response) => ({
    status: 'downloaded',
    data: response.data,
    link,
    tag,
    attr: extractProperty[tag].attr,
  }))
    .catch((e) => ({
      status: 'download error',
      error: e,
      link,
      tag,
      attr: extractProperty[tag].attr,
    })));
  return Promise.all(promises);
};

const save = (downloadResults, output) => {
  const promises = downloadResults.flatMap(({ status, data, filePath }) => {
    if (status === 'downloaded') return fs.writeFile(path.resolve(output, filePath), data);
    return [];
  });
  return Promise.all(promises);
};

const modifyAssets = ($, modifiers) => {
  modifiers.forEach(({ attr, oldValue, newValue }) => $(`[${attr}=${oldValue}]`).attr(attr, newValue));
  return $;
};

const makeModifiers = (downloadResults, assetsDir, host) => downloadResults
  .map(({
    status,
    tag,
    link,
    attr,
  }) => ({
    attr,
    oldValue: link,
    newValue: status === 'downloaded' ? extractProperty[tag].getNewValue(host, link, assetsDir) : extractProperty[tag].onError,
  }));

const pageLoader = (url, output) => {
  const resolvedUrl = new URL(url);
  const mainFileName = getFileName(resolvedUrl.host, resolvedUrl.pathname, '', '.html');
  const assetsDir = mainFileName.replace('.html', '_files');
  const mainFilePath = path.resolve(output, mainFileName);
  const axiosInstance = createAxiosInstance(resolvedUrl);
  let mainPageDownloadResults;
  return fs.mkdir(path.resolve(output, assetsDir))
    .then(() => download(axiosInstance, [{ tag: 'main', link: resolvedUrl.pathname }]))
    .then((downloadResults) => {
      const { status, data: mainPageData, error } = downloadResults[0];
      if (error) throw new Error(`${status}:\n${error}`);
      const $ = parseHTML(mainPageData);
      mainPageDownloadResults = _.cloneDeep(downloadResults[0]);
      mainPageDownloadResults.data = $;
      const links = extractAssetsList($);
      return download(axiosInstance, links);
    })
    .then((downloadResults) => {
      const modifiers = makeModifiers(downloadResults, assetsDir, resolvedUrl.host);
      const $ = mainPageDownloadResults.data;
      const mod$ = modifyAssets($, modifiers);
      mainPageDownloadResults.data = mod$.html();
      mainPageDownloadResults.filePath = mainFileName;
      const modDownloadResults = [mainPageDownloadResults, ...downloadResults]
        .map((downloadRes) => ({
          filePath: downloadRes.status === 'downloaded' ? extractProperty[downloadRes.tag].getNewValue(resolvedUrl.host, downloadRes.link, assetsDir) : '',
          ...downloadRes,
        }));
      save(modDownloadResults, output);
    })
    .then(() => mainFilePath);
};

export default pageLoader;
