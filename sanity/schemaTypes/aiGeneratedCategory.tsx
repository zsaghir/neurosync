import {TagIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

export const aiGeneratedCategory = defineType({
  name: 'aiGeneratedCategory',
  title: 'AI-generated category',
  type: 'document',
  icon: TagIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
  ],
})
