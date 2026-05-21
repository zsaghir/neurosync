import {SparklesIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

/** Categories suggested or assigned by AI; referenced from journal entries. */
export const aiGeneratedCategory = defineType({
  name: 'aiGeneratedCategory',
  title: 'AI-generated category',
  type: 'document',
  icon: SparklesIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Label',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {title: 'title'},
    prepare({title}) {
      return {title: title || 'Untitled category'}
    },
  },
})
