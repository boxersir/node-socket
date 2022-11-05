import { Schema } from 'prosemirror-model';

function setCellAttrs(node) {
  const attrs = node.attrs.alignment
    ? { style: `text-align: ${node.attrs.alignment}` }
    : {};

  /* eslint-disable */
  if (node.attrs.colspan != 1) attrs.colspan = node.attrs.colspan;
  if (node.attrs.rowspan != 1) attrs.rowspan = node.attrs.rowspan;
  if (node.attrs.colwidth) { attrs['data-colwidth'] = node.attrs.colwidth.join(','); }
  return attrs;
}
function getCellAttrs(dom, extraAttrs) {
  const widthAttr = dom.getAttribute('data-colwidth');
  const widths = widthAttr && /^\d+(,\d+)*$/.test(widthAttr) ? widthAttr.split(',').map((s) => Number(s)) : null;
  const colspan = Number(dom.getAttribute('colspan') || 1);
  const result = {
    colspan,
    rowspan: Number(dom.getAttribute('rowspan') || 1),
    colwidth: widths && widths.length == colspan ? widths : null,
  };
  for (const prop in extraAttrs) {
    const getter = extraAttrs[prop].getFromDOM;
    const value = getter && getter(dom);
    if (value != null) result[prop] = value;
  }
  return result;
}

const DEFAULT_FONT_SIZE = 'default';
const SIZE_PATTERN = /([\d.]+)(px|pt|pc|in|mm|cm|%|em)/i;

const toPixel = {
  px: 1,
  pt: 4 / 3,
  in: 96,
  pc: 16,
  mm: 3.78,
  cm: 37.8,
  em: 16,
  '%': 16,
};

function convertToPX(styleValue) {
  const matches = styleValue.match(SIZE_PATTERN);
  if (!matches) return DEFAULT_FONT_SIZE;
  if (!matches[2]) return DEFAULT_FONT_SIZE;
  const value = parseFloat(matches[1]) * toPixel[matches[2]];
  if (!value) return DEFAULT_FONT_SIZE;
  return value.toString();
}

/* eslint-enable */
const schema = {
  nodes: {
    blockquote: {
      content: 'block+',
      group: 'block',
      defining: true,
      draggable: false,
      parseDOM: [
        {
          tag: 'blockquote',
        },
      ],
    },
    bullet_list: {
      content: 'list_item+',
      group: 'block',
      parseDOM: [{ tag: 'ul' }],
      toDOM: () => ['ul', 0],
    },
    code_block: {
      code: 'true',
      content: 'text*',
      defining: true,
      draggable: false,
      group: 'block',
      marks: '',
      parseDOM: [
        {
          preserveWhitespace: 'full',
          tag: 'pre',
        },
      ],
    },
    doc: {
      content: 'block+',
    },
    hard_break: {
      group: 'inline',
      inline: true,
      parseDOM: [
        {
          tag: 'br',
        },
      ],
      selectable: false,
    },
    heading: {
      attrs: {
        level: {
          default: 1,
        },
      },
      content: 'inline*',
      defining: true,
      draggable: false,
      group: 'block',
      parseDOM: [
        {
          tag: 'h1',
          attrs: {
            level: 1,
          },
        },
        {
          tag: 'h2',
          attrs: {
            level: 2,
          },
        },
        {
          tag: 'h3',
          attrs: {
            level: 3,
          },
        },
      ],
    },
    horizontal_rule: {
      group: 'block',
      parseDOM: [{ tag: 'hr' }],
    },
    image: {
      attrs: {
        alt: {
          default: null,
        },
        src: {},
        title: {
          default: null,
        },
        width: {
          default: null,
        },
        height: {
          default: null,
        },
        data_drawUrl: {
          default: null,
        },
      },
      draggable: true,
      group: 'inline',
      inline: true,
      parseDOM: [
        {
          tag: 'img[src]',
        },
      ],
    },
    list_item: {
      content: 'paragraph block*',
      defining: true,
      draggable: true,
      parseDOM: [{ tag: 'li' }],
      toDOM: () => ['li', 0],
    },
    todo_list: {
      group: 'block',
      content: 'todo_item+',
      toDOM: () => ['ul', { class: 'todo_list' }, 0],
      parseDOM: [
        {
          tag: '[class="todo_list"]',
        },
      ],
    },
    todo_item: {
      attrs: {
        checked: {
          default: false,
        },
      },
      content: 'paragraph block*',
      defining: true,
      draggable: true,
      parseDOM: [
        {
          tag: 'li[data-type="todo_item"]',
          getAttrs: (dom) => ({
            checked: dom.className.includes('checked'),
          }),
        },
      ],
    },
    ordered_list: {
      attrs: {
        order: {
          default: 1,
        },
      },
      content: 'list_item+',
      group: 'block',
      parseDOM: [
        {
          tag: 'ol',
          getAttrs: (dom) => ({
            order: dom.hasAttribute('start')
              ? parseInt(dom.getAttribute('start') || '1', 10)
              : 1,
          }),
        },
      ],
      toDOM: (node) => (node.attrs.order === 1
        ? ['ol', 0]
        : ['ol', { start: node.attrs.order }, 0]),
    },
    paragraph: {
      content: 'inline*',
      draggable: false,
      group: 'block',
      parseDOM: [
        {
          tag: 'p',
        },
      ],
    },
    table: {
      content: 'table_row+',
      tableRole: 'table',
      isolating: true,
      group: 'block',
      parseDOM: [{ tag: 'table' }],
      toDOM() {
        return [
          'div',
          { class: 'scrollable-wrapper' },
          [
            'div',
            { class: 'scrollable' },
            ['table', { class: 'rme-table' }, ['tbody', 0]],
          ],
        ];
      },
    },
    table_header: {
      content: 'block+',
      tableRole: 'header_cell',
      isolating: true,
      parseDOM: [{ tag: 'th', getAttrs: (dom) => getCellAttrs(dom) }],
      toDOM(node) {
        return [
          'th',
          setCellAttrs(node),
          0,
        ];
      },
      attrs: {
        colspan: { default: 1 },
        rowspan: { default: 1 },
        colwidth: { default: null },
        alignment: { default: null },
      },
    },
    table_cell: {
      content: 'block+',
      tableRole: 'cell',
      isolating: true,
      parseDOM: [{ tag: 'td', getAttrs: (dom) => getCellAttrs(dom) }],
      toDOM(node) {
        return [
          'td',
          setCellAttrs(node),
          0,
        ];
      },
      attrs: {
        colspan: { default: 1 },
        rowspan: { default: 1 },
        colwidth: { default: null },
        alignment: { default: null },
      },
    },
    table_row: {
      content: '(table_cell | table_header)*',
      tableRole: 'row',
      parseDOM: [{ tag: 'tr' }],
      toDOM() {
        return ['tr', 0];
      },
    },
    text: {
      group: 'inline',
    },
    iframe: {
      attrs: {
        src: {
          default: null,
        },
        height: {
          default: null,
        },
        width: {
          default: null,
        },
        name: {
          default: null,
        },
        filetype: {
          default: null,
        },
      },
      group: 'inline',
      inline: true,
      selectable: true,
      draggable: true,
      allowGapCursor: true,
      // parseDOM and toDOM is still required to make copy and paste work
      parseDOM: [{ tag: 'b' }, {
        tag: 'iframe',
        getAttrs: (dom) => ({
          src: dom.getAttribute('src'),
          height: dom.getAttribute('height'),
          width: dom.getAttribute('width'),
          name: dom.getAttribute('name'),
        }),
      }],
      toDOM: (node) => ['b', ['iframe', {
        src: node.attrs.src,
        height: node.attrs.height,
        width: node.attrs.width,
        name: node.attrs.name,
        frameborder: 0,
        allowfullscreen: 'true',
      }]],
    },
    tr: {
      group: 'block',
      content: '(th | td)*',
    },
    th: {
      group: 'block',
      content: 'paragraph*',
    },
    td: {
      group: 'block',
      content: 'paragraph+',
    },
    categories: {
      content: 'categorie_item+',
      categorieRole: 'categories',
      isolating: true,
      group: 'block',
      parseDOM: [{ tag: 'div' }],
      toDOM() {
        return [
          'div',
          { class: 'categories-wrapper' },
          0,
        ];
      },
    },
    categorie_item: {
      content: 'paragraph',
      categorieRole: 'categorie_item',
      isolating: true,
      parseDOM: [{ tag: 'div', getAttrs: (dom) => getCellAttrs(dom) }],
      toDOM(node) {
        return [
          'div',
          { class: node.attrs.isHidden ? 'categorie-item isHidden' : 'categorie-item', ...setCellAttrs(node), contenteditable: 'false' },
          0,
        ];
      },
      attrs: {
        level: { default: 0 },
        value: { default: '' },
        isLeaf: { default: false },
        active: { default: false },
        index: { default: '' },
        isHidden: { default: false },
      },
    },
    mention: {
      attrs: {
        id: {},
        label: {},
        status: {},
      },
      group: 'inline',
      inline: true,
      selectable: false,
      atom: true,
      parseDOM: [
        {
          tag: 'cite[data-mention-id]',
          getAttrs: (dom) => {
            const id = dom.getAttribute('data-mention-id');
            const status = dom.getAttribute('data-mention-status');
            const label = dom.innerText.split(this.options.matcher.char).join('');
            return { id, status, label };
          },
        },
      ],
    },
  },
  marks: {
    bold: {
      parseDOM: [
        {
          tag: 'strong',
        },
        {
          tag: 'b',
        },
        {
          style: 'font-weight',
        },
      ],
    },
    code: {
      parseDOM: [
        {
          tag: 'code',
        },
      ],
    },
    italic: {
      parseDOM: [
        {
          tag: 'i',
        },
        {
          tag: 'em',
        },
        {
          style: 'font-style=italic',
        },
      ],
    },
    link: {
      attrs: {
        href: {},
      },
      draggable: true,
      group: 'inline',
      inline: true,
      parseDOM: [
        {
          tag: 'a[href]',
        },
      ],
    },
    strike: {
      parseDOM: [
        {
          tag: 's',
        },
        {
          tag: 'del',
        },
        {
          tag: 'strike',
        },
        {
          style: 'text-decoration',
        },
      ],
    },
    underline: {
      parseDOM: [
        {
          tag: 'u',
        },
        {
          style: 'text-decoration',
        },
      ],
    },
    font_size: {
      attrs: {
        px: { default: '16' },
      },
      inline: true,
      group: 'inline',
      parseDOM: [
        {
          style: 'font-size',
          getAttrs: (fontSize) => {
            const attrs = {};
            if (!fontSize) return attrs;
            const px = convertToPX(fontSize);
            if (!px) return attrs;
            return {
              px,
            };
          },
        },
      ],
    },
    text_highlight: {
      parseDOM: [{
        tag: 'span[crossId]',
        getAttrs: (dom) => {
          if (dom.getAttribute('crossId') && dom.getAttribute('crossId') !== 'default') {
            if (!dom.getAttribute('crossHide') || !dom.getAttribute('crossHide') === 'false') {
              return {
                highlightColor: '#F3C641',
                crossId: dom.getAttribute('crossId'),
                crossAreas: 'crossAreas',
              };
            }
            return {
              crossId: dom.getAttribute('crossId'),
              crossHide: dom.getAttribute('crossHide'),
            };
          }
          return {};
        },
      }],
    },
    text_bg_color: {
      attrs: {
        color: '#FCF5CE',
      },
      inline: true,
      group: 'inline',
      parseDOM: [{
        style: 'background-color',
        getAttrs: (color) => ({
          color,
        }),
      }],
    },
    text_color: {
      attrs: {
        color: 'default',
      },
      parseDOM: [
        {
          style: 'color',
          getAttrs: (color) => ({
            color,
          }),
        },
      ],
    },
    em: {
      parseDOM: [{ tag: 'i' }, { tag: 'em' }, { style: 'font-style=italic' }],
    },
    strong: {
      parseDOM: [{ tag: 'strong' },
        {
          tag: 'b', getAttrs: (node) => node.style.fontWeight !== 'normal' && null,
        },
        {
          style: 'font-weight', getAttrs: (value) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null,
        }],
    },
  },
};

export default new Schema(schema);
