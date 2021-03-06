import fetch from 'node-fetch';
import layertree from '../src/layertree.js';

const defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YjNhNmQ4My01OTdlLTRjNmQtYTllYS1lMjM0NmYxZTU5ZmUiLCJpZCI6MTg3NTIsInNjb3BlcyI6WyJhc2wiLCJhc3IiLCJhc3ciLCJnYyJdLCJpYXQiOjE1NzQ0MTAwNzV9.Cj3sxjA_x--bN6VATcN4KE9jBJNMftlzPuA8hawuZkY';

function fetchIon(url, token=defaultAccessToken) {
  return fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
}

const header = `
/* eslint-disable */
// DO NOT EDIT: this is file is automatically generated by get_assets_properties script
`;

const reduceTree = (func, init, node) => {
  const acc = func(init, node);
  if (!node.children) {
    return acc;
  } else {
    return node.children.reduce((acc, node) => reduceTree(func, acc, node), acc);
  }
}
const getAssetId = (acc, node) => {
  if (node.type === '3dtiles' && node.assetId !== undefined) {
    acc.push(node.assetId);
  }
  return acc;
}

const assetIds = reduceTree(getAssetId, [], {children: layertree});

const endpoints = Promise.all(assetIds.map(id => fetchIon(`https://api.cesium.com/v1/assets/${id}/endpoint`)))
  .then(responses => Promise.all(responses.map(response => response.json())));

// only keep the 3d tiles tilesets and request the tileset.json files
const tilesets = endpoints.then(responses => responses.filter(response => response.type === '3DTILES'))
  .then(assets => assets.map(asset => fetchIon(asset.url, asset.accessToken)))
  .then(requests => Promise.all(requests))
  .then(responses => Promise.all(responses.map(response => response.json())));

// create an array of all properties
const properties = tilesets.then(responses => responses.filter(response => response.properties))
  .then(responses => responses.map(response => Object.keys(response.properties)).flat())
  .then(properties => Array.from(new Set(properties)));

// filter out properties
properties.then(values => values.filter(value => !value.startsWith('_')))
  .then(values => values.sort().map(value => `i18next.t('assets:${value}');`))
  .then(values => [header].concat(values))
  .then(values => console.log(values.join('\n')));
