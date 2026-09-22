declare module 'jspdf-autotable' {
  import { jsPDF } from 'jspdf'

  interface AutoTableOptions {
    head?: any[][]
    body?: any[][]
    startY?: number
    styles?: any
    headStyles?: any
    margin?: any
    [key: string]: any
  }

  function autoTable(doc: jsPDF, options: AutoTableOptions): void

  export default autoTable
}

declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable?: { finalY: number }
    drawImage(
      image: string | HTMLImageElement | HTMLCanvasElement,
      x: number,
      y: number,
      width: number,
      height: number
    ): void
  }
}