import {CogIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

export const userSettings = defineType({
  name: 'userSettings',
  title: 'User settings',
  type: 'document',
  icon: CogIcon,
  fields: [
    defineField({
      name: 'userId',
      title: 'User ID',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'preferredTimeEstimationMode',
      title: 'Preferred time estimation method',
      type: 'string',
      initialValue: 'relative',
      options: {
        list: [
          {title: 'Quick / Medium / Long', value: 'relative'},
          {title: 'Minute presets', value: 'minutes'},
          {title: 'Custom time entry', value: 'custom'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'themeMode',
      title: 'Theme mode',
      type: 'string',
      initialValue: 'dark',
      options: {
        list: [
          {title: 'Dark', value: 'dark'},
          {title: 'Light', value: 'light'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'timeEstimateMode',
      title: 'Time estimate mode (deprecated)',
      type: 'string',
      deprecated: {
        reason: 'Use preferredTimeEstimationMode instead.',
      },
      readOnly: true,
      hidden: ({value}) => value === undefined,
      initialValue: undefined,
    }),
    defineField({
      name: 'bucketEstimate',
      title: 'Bucket estimate (deprecated)',
      type: 'string',
      deprecated: {
        reason: 'Specific estimate choices are task-level data.',
      },
      readOnly: true,
      hidden: ({value}) => value === undefined,
      initialValue: undefined,
    }),
    defineField({
      name: 'presetEstimateMinutes',
      title: 'Preset estimate minutes (deprecated)',
      type: 'number',
      deprecated: {
        reason: 'Specific estimate choices are task-level data.',
      },
      readOnly: true,
      hidden: ({value}) => value === undefined,
      initialValue: undefined,
    }),
    defineField({
      name: 'customEstimateMinutes',
      title: 'Custom estimate minutes (deprecated)',
      type: 'number',
      deprecated: {
        reason: 'Specific estimate choices are task-level data.',
      },
      readOnly: true,
      hidden: ({value}) => value === undefined,
      initialValue: undefined,
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
      title: 'userId',
      mode: 'preferredTimeEstimationMode',
      legacyMode: 'timeEstimateMode',
      theme: 'themeMode',
    },
    prepare({title, mode, legacyMode, theme}) {
      return {
        title: title || 'User settings',
        subtitle: `${mode || legacyMode || 'relative'} · ${theme || 'dark'}`,
      }
    },
  },
})
