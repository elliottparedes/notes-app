import { Node, mergeAttributes } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';

export const NoteLink = Node.create({
  name: 'noteLink',

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'note-link',
      },
      suggestion: {
        char: '[[',
        pluginKey: new PluginKey('noteLinkSuggestion'),
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: 'noteLink',
                attrs: props,
              },
            ])
            .insertContent(' ')
            .run();
        },
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          const type = $from.parent.type.name;
          return type !== 'codeBlock';
        },
      },
    };
  },

  group: 'inline',
  inline: true,
  selectable: false,
  atom: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-id'),
        renderHTML: attributes => {
          if (!attributes.id) {
            return {};
          }
          return {
            'data-id': attributes.id,
          };
        },
      },
      label: {
        default: null,
        parseHTML: element => element.getAttribute('data-label'),
        renderHTML: attributes => {
          if (!attributes.label) {
            return {};
          }
          return {
            'data-label': attributes.label,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-id]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      `${node.attrs.label ?? node.attrs.id}`,
    ];
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
