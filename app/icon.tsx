import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

export const size = {
  width: 32,
  height: 32,
}

export const contentType = 'image/png'

export default async function Icon() {
  const logo = await readFile(join(process.cwd(), 'public', 'lingkod-logo.png'))
  const logoDataUrl = `data:image/png;base64,${logo.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
          borderRadius: '9999px',
          overflow: 'hidden',
        }}
      >
        <img
          src={logoDataUrl}
          alt="Barangay logo"
          width={32}
          height={32}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
    ),
    {
      ...size,
    },
  )
}
