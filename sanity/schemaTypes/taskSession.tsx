import {ClockIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

export const taskSession = defineType({
  name: 'taskSession',
  title: 'Task session',
  type: 'document',
  icon: ClockIcon,
  fields: [
    defineField({
      name: 'taskId',
      title: 'Task ID',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'userId',
      title: 'User ID',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'taskTitle',
      title: 'Task title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'taskTitleSignature',
      title: 'Task title signature',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'estimatedMinutes',
      title: 'Estimated minutes',
      type: 'number',
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: 'estimateInputType',
      title: 'Estimate input type',
      type: 'string',
      options: {
        list: [
          {title: 'Bucket', value: 'bucket'},
          {title: 'Preset', value: 'preset'},
          {title: 'Custom', value: 'custom'},
          {title: 'Skipped', value: 'skipped'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'timerMeasuredSeconds',
      title: 'Timer measured seconds',
      type: 'number',
      validation: (rule) => rule.required().min(0),
    }),
    defineField({
      name: 'actualSeconds',
      title: 'Actual seconds',
      type: 'number',
      validation: (rule) => rule.required().min(0),
    }),
    defineField({
      name: 'actualSecondsSource',
      title: 'Actual seconds source',
      type: 'string',
      options: {
        list: [
          {title: 'Timer', value: 'timer'},
          {title: 'User edited', value: 'userEdited'},
          {title: 'Manual', value: 'manual'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'startedAt',
      title: 'Started at',
      type: 'datetime',
    }),
    defineField({
      name: 'endedAt',
      title: 'Ended at',
      type: 'datetime',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'excludedFromInsights',
      title: 'Excluded from insights',
      type: 'boolean',
      initialValue: false,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'excludeReason',
      title: 'Exclude reason',
      type: 'string',
    }),
    defineField({
      name: 'createdAt',
      title: 'Created at',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'updatedAt',
      title: 'Updated at',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {
      title: 'taskTitle',
      actualSeconds: 'actualSeconds',
      excluded: 'excludedFromInsights',
    },
    prepare({title, actualSeconds, excluded}) {
      const minutes = actualSeconds ? Math.round(actualSeconds / 60) : 0

      return {
        title: title || 'Untitled task session',
        subtitle: `${minutes} min${excluded ? ' · not counted' : ''}`,
      }
    },
  },
})
