import { describe, expect, it } from 'vitest'
import {
  filesToReportAttachments,
  isAllowedReportAttachment,
  sanitizeAttachmentDisplayName,
} from './reportAttachments'

describe('sanitizeAttachmentDisplayName', () => {
  it('uses generic screenshot names instead of original filenames', () => {
    expect(sanitizeAttachmentDisplayName('image/png', 0)).toBe(
      'screenshot-1.png',
    )
    expect(sanitizeAttachmentDisplayName('application/pdf', 2)).toBe(
      'file-3.pdf',
    )
  })
})

describe('isAllowedReportAttachment', () => {
  it('accepts images and PDFs under the size limit', () => {
    expect(
      isAllowedReportAttachment(
        new File(['x'], 'secret-jordan.png', { type: 'image/png' }),
      ),
    ).toBe(true)
    expect(
      isAllowedReportAttachment(
        new File(['x'], 'notes.pdf', { type: 'application/pdf' }),
      ),
    ).toBe(true)
  })

  it('rejects disallowed types', () => {
    expect(
      isAllowedReportAttachment(
        new File(['x'], 'run.exe', { type: 'application/octet-stream' }),
      ),
    ).toBe(false)
  })
})

describe('filesToReportAttachments', () => {
  it('strips original filenames from stored attachments', async () => {
    const file = new File(['png-bytes'], 'kalena-iphone-IMG_0042.png', {
      type: 'image/png',
    })
    const attachments = await filesToReportAttachments([file])
    expect(attachments).toHaveLength(1)
    expect(attachments[0].displayName).toBe('screenshot-1.png')
    expect(attachments[0].mimeType).toBe('image/png')
    expect(attachments[0].dataUrl.startsWith('data:image/png')).toBe(true)
    expect(JSON.stringify(attachments)).not.toContain('kalena')
    expect(JSON.stringify(attachments)).not.toContain('iphone')
  })
})
