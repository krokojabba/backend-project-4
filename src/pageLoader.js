import axios from 'axios';
import path from 'path';
import fs from 'fs/promises';

const getFileName = (urlString) => {
  const { host, pathname } = new URL(urlString);
  const rawName = `${host}${pathname.length === 1 ? '' : pathname}`;
  const regex = /[^A-Za-z0-9]+/g;
  const name = rawName.replace(regex, '-');
  return `${name}.html`;
};

/* const getContent = (url) => {
  axios.get(url)
    .then((response) => {
      console.log(response.data);
      return response.data;
    });
};

const saveContent = (filePath, content) => fs.writeFile(filePath, content); */

const pageLoader = (url, output) => {
  const filePath = path.resolve(output, getFileName(url));
  return axios.get(url)
    .then(({ data }) => fs.writeFile(filePath, data))
    .then(() => filePath);
};

export default pageLoader;
