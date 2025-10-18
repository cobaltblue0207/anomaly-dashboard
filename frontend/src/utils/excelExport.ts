import ExcelJS from 'exceljs';

export async function exportToExcel(rows: any[], sessionUserId: string, notesData?: Record<string, any>) {
  try {
    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');

    // V2 스키마 (메인 스키마)
      worksheet.columns = [
        { header: 'MASTER_TASK_ID', key: 'MASTER_TASK_ID', width: 35 },
        { header: 'LINE', key: 'LINE', width: 12 },
        { header: 'AREA', key: 'AREA', width: 12 },
        { header: 'Equipment', key: 'PROD_EQP_ID', width: 15 },
        { header: 'Parameter', key: 'PARAM_SUBITEM', width: 40 },
        { header: 'PPID', key: 'PPID', width: 20 },
        { header: 'Recipe', key: 'RECIPEID', width: 20 },
        { header: 'Step', key: 'CH_STEP', width: 20 },
        { header: 'Model Result', key: 'MODEL_RESULT_INFO', width: 30 },
        { header: 'Comments', key: 'COMMENTS', width: 40 },
        { header: '30D Chart', key: 'chart_30d', width: 60 },
        { header: '60D Chart', key: 'chart_60d', width: 60 },
        { header: 'Notes', key: 'notes', width: 50 },
      ];

    // Style header row
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    
    // Freeze first row (header row only)
    worksheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 1 }
    ];

    // Add data rows with images
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because header is row 1, data starts at row 2

      // Set row height for image first
      worksheet.getRow(rowNumber).height = 200; // ~267 pixels

      // Get variant ID for chart lookup
      const variantId = row.MASTER_TASK_ID || row.variant_id;

      // Add text data directly to cells (not using addRow to avoid row shifting)
        const cellAlignment = { vertical: 'middle' as const, horizontal: 'center' as const };
        
        // 1. MASTER_TASK_ID
        worksheet.getCell(rowNumber, 1).value = row.MASTER_TASK_ID || '';
        worksheet.getCell(rowNumber, 1).alignment = cellAlignment;
        
        // 2. LINE
        worksheet.getCell(rowNumber, 2).value = row.LINE || '';
        worksheet.getCell(rowNumber, 2).alignment = cellAlignment;
        
        // 3. AREA
        worksheet.getCell(rowNumber, 3).value = row.AREA || '';
        worksheet.getCell(rowNumber, 3).alignment = cellAlignment;
        
        // 4. Equipment (PROD_EQP_ID)
        worksheet.getCell(rowNumber, 4).value = row.PROD_EQP_ID || '';
        worksheet.getCell(rowNumber, 4).alignment = cellAlignment;
        
        // 5. Parameter (PARAM_SUBITEM)
        worksheet.getCell(rowNumber, 5).value = row.PARAM_SUBITEM || '';
        worksheet.getCell(rowNumber, 5).alignment = cellAlignment;
        
        // 6. PPID
        worksheet.getCell(rowNumber, 6).value = row.PPID || '';
        worksheet.getCell(rowNumber, 6).alignment = cellAlignment;
        
        // 7. Recipe (RECIPEID)
        worksheet.getCell(rowNumber, 7).value = row.RECIPEID || '';
        worksheet.getCell(rowNumber, 7).alignment = cellAlignment;
        
        // 8. Step (CH_STEP)
        worksheet.getCell(rowNumber, 8).value = row.CH_STEP || '';
        worksheet.getCell(rowNumber, 8).alignment = cellAlignment;
        
        // 9. Model Result (MODEL_RESULT_INFO)
        worksheet.getCell(rowNumber, 9).value = row.MODEL_RESULT_INFO || '';
        worksheet.getCell(rowNumber, 9).alignment = cellAlignment;
        
        // 10. Comments (COMMENTS)
        worksheet.getCell(rowNumber, 10).value = row.COMMENTS || '';
        worksheet.getCell(rowNumber, 10).alignment = cellAlignment;
        
        // 11. 30D Chart (will be replaced with image)
        worksheet.getCell(rowNumber, 11).value = '';
        worksheet.getCell(rowNumber, 11).alignment = cellAlignment;
        
        // 12. 60D Chart (will be replaced with image)
        worksheet.getCell(rowNumber, 12).value = '';
        worksheet.getCell(rowNumber, 12).alignment = cellAlignment;
        

      // Helper function to add chart image
      const addChartImage = (chartSelector: string, colIndex: number) => {
        try {
          const chartDiv = document.querySelector(`[data-variant-id="${chartSelector}"]`);
          if (chartDiv) {
            const canvas = chartDiv.querySelector('canvas');
            if (canvas) {
              const dataUrl = canvas.toDataURL('image/png');
              const base64Data = dataUrl.split(',')[1];

              const imageId = workbook.addImage({
                base64: base64Data,
                extension: 'png',
              });

              const pixelToEMU = 9525;
              const colWidth = 60;
              const rowHeightPoints = 200;
              const cellWidthPixels = colWidth * 8;
              const cellHeightPixels = rowHeightPoints * (4/3);
              const marginPercentage = 0.05;
              
              const leftMarginEMU = Math.round(cellWidthPixels * marginPercentage * pixelToEMU);
              const topMarginEMU = Math.round(cellHeightPixels * marginPercentage * pixelToEMU);
              const rightMarginEMU = Math.round(cellWidthPixels * marginPercentage * pixelToEMU);
              const bottomMarginEMU = Math.round(cellHeightPixels * marginPercentage * pixelToEMU);

              worksheet.addImage(imageId, {
                tl: { 
                  col: colIndex,
                  row: rowNumber - 1,
                  nativeCol: colIndex,
                  nativeRow: rowNumber - 1,
                  nativeColOff: leftMarginEMU,
                  nativeRowOff: topMarginEMU
                } as any,
                br: {
                  col: colIndex + 1,
                  row: rowNumber,
                  nativeCol: colIndex + 1,
                  nativeRow: rowNumber,
                  nativeColOff: -rightMarginEMU,
                  nativeRowOff: -bottomMarginEMU
                } as any,
                editAs: 'twoCell'
              });
              return true;
            }
          }
          return false;
        } catch (error) {
          console.warn('Failed to capture chart:', chartSelector, error);
          return false;
        }
      };

      // Add chart images (30D and 60D charts)
      const success30d = addChartImage(`${variantId}-30d`, 10); // Column 11 (0-indexed)
      const success60d = addChartImage(`${variantId}-60d`, 11); // Column 12 (0-indexed)
      
      if (!success30d) {
        worksheet.getCell(rowNumber, 11).value = 'Chart export failed';
      }
      if (!success60d) {
        worksheet.getCell(rowNumber, 12).value = 'Chart export failed';
      }

      // Add Notes data with proper formatting
      if (notesData && variantId && notesData[variantId]) {
        const noteData = notesData[variantId];
        let noteText = '';
        
        if (typeof noteData === 'object' && noteData.note) {
          noteText = noteData.note;
        } else if (typeof noteData === 'string') {
          noteText = noteData;
        }
        
        // Apply line breaks and preserve formatting
        if (noteText) {
          // Replace \n with actual line breaks for Excel
          const formattedNote = noteText.replace(/\n/g, '\n');
          worksheet.getCell(rowNumber, 13).value = formattedNote; // Notes column (13th column, 0-indexed)
          
          // Set cell alignment for better readability
          worksheet.getCell(rowNumber, 13).alignment = {
            vertical: 'top',
            horizontal: 'left',
            wrapText: true
          };
        }
      }

    }

    // Generate filename with timestamp (KST, 한국시간)
    const now = new Date();
    // Convert to KST (UTC+9)
    const kst = new Date(now.getTime());
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timestamp = `${kst.getFullYear()}-${pad(kst.getMonth() + 1)}-${pad(kst.getDate())}-${pad(kst.getHours())}-${pad(kst.getMinutes())}-${pad(kst.getSeconds())}`;
    const filename = `anomaly_review_${sessionUserId}_${timestamp}.xlsx`;

    // Generate buffer and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true, filename };
  } catch (error) {
    console.error('Excel export failed:', error);
    return { success: false, error: String(error) };
  }
}

