import { COMMENT_NODE } from 'domconstants/constants';
import { TEXT_ELEMENTS } from 'domconstants/re';
import parser from '@webreflection/uparser';

import { empty, isArray, set } from './utils.js';
import { cel, entry } from './literals.js';

import { array, attribute, hole, text, removeAttribute } from './handler.js';
import createContent from './create-content.js';

/** @typedef {import("./literals.js").Entry} Entry */

/**
 * @typedef {Object} Resolved
 * @property {DocumentFragment} content
 * @property {Entry[]} entries
 * @property {function[]} updates
 * @property {number} length
 */

/**
 * @param {Element} node
 * @returns {number[]}
 */
const createPath = node => {
  const path = [];
  let parentNode;
  while ((parentNode = node.parentNode)) {
    path.push(path.indexOf.call(parentNode.childNodes, node));
    node = parentNode;
  }
  return path;
};

/**
 * @param {TemplateStringsArray} template
 * @param {boolean} xml
 * @returns {Resolved}
 */
const resolve = (template, values, xml) => {
  const content = createContent(parser(template, prefix, xml), xml);
  const { length } = template;
  let asArray = false, entries = empty;
  if (length > 1) {
    const replace = [];
    const tw = document.createTreeWalker(content, 1 | 128);
    let i = 0, search = `${prefix}${i++}`;
    entries = [];
    while (i < length) {
      const node = tw.nextNode();
      if (node.nodeType === COMMENT_NODE) {
        if (node.data === search) {
          const update = isArray(values[i - 1]) ? array : hole;
          if (update === hole) replace.push(node);
          else asArray = true;
          entries.push(entry(createPath(node), update));
          search = `${prefix}${i++}`;
        }
      }
      else {
        let path;
        while (node.hasAttribute(search)) {
          if (!path) path = createPath(node);
          const name = node.getAttribute(search);
          entries.push(entry(path, attribute(node, name, xml), name));
          removeAttribute(node, search);
          search = `${prefix}${i++}`;
        }
        if (
          TEXT_ELEMENTS.test(node.localName) &&
          node.textContent.trim() === `<!--${search}-->`
        ) {
          entries.push(entry(path || createPath(node), text));
          search = `${prefix}${i++}`;
        }
      }
    }
    // can't replace holes on the fly or the tree walker fails
    for (i = 0; i < replace.length; i++)
      replace[i].replaceWith(document.createTextNode(''));
  }
  const l = content.childNodes.length;
  return set(cache, template, cel(content, entries, l === 1 && asArray ? 0 : l));
};

/** @type {WeakMap<TemplateStringsArray, Resolved>} */
const cache = new WeakMap;
const prefix = 'isµ';

/**
 * @param {boolean} xml
 * @returns {(template: TemplateStringsArray, values: any[]) => Resolved}
 */
export default xml => (template, values) => cache.get(template) || resolve(template, values, xml);
