import { Injectable } from '@angular/core';
import { DocFormData } from '../models/doc-generator.models';

@Injectable({
  providedIn: 'root'
})
export class PdfExportService {
  generatePDF(formData: DocFormData): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          const jspdfNs = (window as any).jspdf;
          if (!jspdfNs || !jspdfNs.jsPDF) {
            throw new Error('jsPDF no está disponible en window.jspdf');
          }
          const { jsPDF } = jspdfNs;
          const doc = new jsPDF();
          const margin = 15;
          let currentY = 20;

          const checkPageBreak = (neededHeight: number) => {
            if (currentY + neededHeight > 275) {
              doc.addPage();
              currentY = 20;
            }
          };

          // --- HEADER ---
          doc.setDrawColor(56, 128, 255);
          doc.setLineWidth(1.5);
          doc.line(margin, 25, 195, 25);

          doc.setFontSize(26);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(56, 128, 255);
          doc.text((formData.name || 'Componente Ionic').toUpperCase(), margin, 20);

          currentY = 32;
          if (formData.subtitle) {
            doc.setFontSize(14);
            doc.setFont('courier', 'italic');
            doc.setTextColor(100, 116, 139);
            doc.text(formData.subtitle.toLowerCase(), margin, currentY);
            currentY += 8;
          }

          // STATUS BADGE
          const statusText = (formData.status || 'ESTABLE').toUpperCase();
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          const statusWidth = doc.getTextWidth(statusText);
          doc.setFillColor(30, 41, 59);
          doc.roundedRect(195 - statusWidth - 8, 14, statusWidth + 8, 6, 3, 3, 'F');
          doc.setTextColor(255, 255, 255);
          doc.text(statusText, 195 - statusWidth - 4, 18.5);

          // GLOBAL DESCRIPTION
          currentY += 5;
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(148, 163, 184);
          doc.text('DESCRIPCIÓN DEL COMPONENTE', margin, currentY);

          currentY += 6;
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(71, 85, 105);
          const splitDesc = doc.splitTextToSize(formData.description || 'Sin descripción.', 175);
          doc.text(splitDesc, margin + 6, currentY);
          currentY += splitDesc.length * 5 + 12;

          // API TABLE
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(56, 128, 255);
          doc.text('API: PARÁMETROS', margin, currentY);

          doc.autoTable({
            startY: currentY + 4,
            head: [['Nombre', 'Tipo', 'Descripción']],
            body: formData.globalParameters.map((p) => [
              p.name || '-',
              p.type || 'any',
              p.description || '-'
            ]),
            theme: 'grid',
            headStyles: { fillColor: [56, 128, 255], fontSize: 10 },
            styles: { lineWidth: 0.1, lineColor: [226, 232, 240], cellPadding: 3 }
          });
          currentY = doc.lastAutoTable.finalY + 15;

          // MÉTODOS
          if (formData.methods.length > 0) {
            checkPageBreak(30);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(244, 180, 0);
            doc.text('LÓGICA INTERNA', margin, currentY);

            doc.autoTable({
              startY: currentY + 4,
              head: [['Método', 'Firma', 'Descripción']],
              body: formData.methods.map((m) => [
                m.name || '-',
                m.details || 'void',
                m.description || '-'
              ]),
              theme: 'grid',
              headStyles: { fillColor: [244, 180, 0], fontSize: 10 },
              styles: { lineWidth: 0.1, lineColor: [226, 232, 240], cellPadding: 3 }
            });
            currentY = doc.lastAutoTable.finalY + 15;
          }

          // VARIANTES
          checkPageBreak(40);
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(148, 163, 184);
          doc.text('GALERÍA DE VARIANTES', margin, currentY);
          currentY += 10;

          formData.variants.forEach((v, idx) => {
            checkPageBreak(60);
            doc.setDrawColor(30, 41, 59);
            doc.setLineWidth(2);
            doc.line(margin, currentY - 4, margin, currentY + 4);
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text(`${idx + 1}. ${v.name || 'Variante'}`.toUpperCase(), margin + 5, currentY);
            currentY += 8;

            if (v.description) {
              doc.setFontSize(9);
              doc.setFont('helvetica', 'italic');
              doc.setTextColor(100, 116, 139);
              const vDesc = doc.splitTextToSize(v.description, 175);
              doc.text(vDesc, margin + 5, currentY);
              currentY += vDesc.length * 5 + 6;
            } else {
              currentY += 2;
            }

            const blockY = currentY;
            const imgW = 75;
            const imgH = 45;

            if (v.image) {
              try {
                doc.addImage(v.image, 'JPEG', margin + 5, blockY, imgW, imgH);
              } catch (e) {
                console.error(e);
              }
            } else {
              doc.setFillColor(250, 250, 250);
              doc.rect(margin + 5, blockY, imgW, imgH, 'F');
            }

            const vProps = v.selectedProperties.map((sp) => {
              const p = formData.globalParameters.find((g) => g.id === sp.parameterId);
              return [p ? p.name : '-', sp.value || '-'];
            });

            doc.autoTable({
              startY: blockY,
              margin: { left: margin + 85 },
              head: [['Atributo', 'Valor']],
              body: vProps,
              theme: 'grid',
              headStyles: { fillColor: [71, 85, 105], fontSize: 8 },
              bodyStyles: { fontSize: 8 },
              styles: { lineWidth: 0.1, lineColor: [226, 232, 240], cellPadding: 2 }
            });

            const endT = doc.lastAutoTable.finalY;
            currentY = Math.max(endT, blockY + imgH) + 15;
          });

          // GIT HISTORY
          if (formData.historyCommits.length > 0) {
            checkPageBreak(40);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('TRAZABILIDAD GIT', margin, currentY);
            doc.autoTable({
              startY: currentY + 4,
              head: [['Mensaje', 'Hash']],
              body: formData.historyCommits.map((c) => [
                c.title || '-',
                (c.hash || 'N/A').toUpperCase()
              ]),
              theme: 'grid',
              headStyles: { fillColor: [30, 41, 59], fontSize: 9 },
              bodyStyles: { fontSize: 8, textColor: [255, 255, 255], fillColor: [30, 41, 59] },
              columnStyles: { 1: { fontStyle: 'bold', textColor: [96, 165, 250], font: 'courier' } }
            });
          }

          doc.save(`${formData.name || 'documento'}.pdf`);
        } catch (err) {
          console.error(err);
          alert('Error al exportar.');
        } finally {
          resolve();
        }
      }, 500);
    });
  }
}
