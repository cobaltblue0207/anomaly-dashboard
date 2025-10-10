import ExcelJS from 'exceljs';

export async function exportToExcel(rows: any[], sessionUserId: string) {
  try {
    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');

    // Detect schema version
    const isV2 = rows.length > 0 && "MASTER_TASK_ID" in rows[0];

    // Define columns based on schema version
    if (isV2) {
      worksheet.columns = [
        { header: 'MASTER_TASK_ID', key: 'MASTER_TASK_ID', width: 35 },
        { header: 'LINE', key: 'LINE', width: 12 },
        { header: 'AREA', key: 'AREA', width: 12 },
        { header: 'Equipment', key: 'PROD_EQP_ID', width: 15 },
        { header: 'Parameter', key: 'PARAM_SUBITEM', width: 40 },
        { header: '30D Chart', key: 'chart_30d', width: 60 },
        { header: '60D Chart', key: 'chart_60d', width: 60 },
        { header: 'PPID', key: 'PPID', width: 20 },
        { header: 'Recipe', key: 'RECIPEID', width: 20 },
        { header: 'Step', key: 'CH_STEP', width: 20 },
        { header: 'Model Result', key: 'MODEL_RESULT_INFO', width: 30 },
        { header: 'Comments', key: 'COMMENTS', width: 40 },
        { header: 'Notes', key: 'notes', width: 50 },
      ];
    } else {
      // Legacy schema
      worksheet.columns = [
        { header: 'Variant ID', key: 'variant_id', width: 35 },
        { header: 'Chart', key: 'chart', width: 60 },
        { header: 'Informations', key: 'informations', width: 45 },
        { header: 'Pattern', key: 'pattern', width: 20 },
        { header: 'Model Result', key: 'model_result', width: 15 },
        { header: 'Notes', key: 'notes', width: 50 },
      ];
    }

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

      // Get variant ID for chart lookup (V2: MASTER_TASK_ID, Legacy: variant_id)
      const variantId = isV2 ? (row.MASTER_TASK_ID || row.variant_id) : row.variant_id;

      // Add text data directly to cells (not using addRow to avoid row shifting)
      if (isV2) {
        const cellAlignment = { vertical: 'middle' as const, horizontal: 'center' as const };
        
        worksheet.getCell(rowNumber, 1).value = row.MASTER_TASK_ID || '';
        worksheet.getCell(rowNumber, 1).alignment = cellAlignment;
        
        worksheet.getCell(rowNumber, 2).value = row.LINE || '';
        worksheet.getCell(rowNumber, 2).alignment = cellAlignment;
        
        worksheet.getCell(rowNumber, 3).value = row.AREA || '';
        worksheet.getCell(rowNumber, 3).alignment = cellAlignment;
        
        worksheet.getCell(rowNumber, 4).value = row.PROD_EQP_ID || '';
        worksheet.getCell(rowNumber, 4).alignment = cellAlignment;
        
        worksheet.getCell(rowNumber, 5).value = row.PARAM_SUBITEM || '';
        worksheet.getCell(rowNumber, 5).alignment = cellAlignment;
        
        worksheet.getCell(rowNumber, 6).value = ''; // 30D Chart column (will be replaced with image)
        worksheet.getCell(rowNumber, 6).alignment = cellAlignment;
        
        worksheet.getCell(rowNumber, 7).value = ''; // 60D Chart column (will be replaced with image)
        worksheet.getCell(rowNumber, 7).alignment = cellAlignment;
        
        worksheet.getCell(rowNumber, 8).value = row.PPID || '';
        worksheet.getCell(rowNumber, 8).alignment = cellAlignment;
        
        worksheet.getCell(rowNumber, 9).value = row.RECIPEID || '';
        worksheet.getCell(rowNumber, 9).alignment = cellAlignment;
        
        worksheet.getCell(rowNumber, 10).value = row.CH_STEP || '';
        worksheet.getCell(rowNumber, 10).alignment = cellAlignment;
        
        const modelResult = String(row.MODEL_RESULT_INFO || '').toUpperCase().includes('TRUE') ? 'TRUE' : 'FALSE';
        worksheet.getCell(rowNumber, 11).value = modelResult;
        worksheet.getCell(rowNumber, 11).alignment = cellAlignment;
        
        worksheet.getCell(rowNumber, 12).value = row.COMMENTS || '';
        worksheet.getCell(rowNumber, 12).alignment = cellAlignment;
        
        worksheet.getCell(rowNumber, 13).value = row.notes || '';
        worksheet.getCell(rowNumber, 13).alignment = cellAlignment;
      } else {
        const cellAlignment = { vertical: 'middle' as const, horizontal: 'center' as const };
        
        worksheet.getCell(rowNumber, 1).value = row.variant_id || '';
        worksheet.getCell(rowNumber, 1).alignment = cellAlignment;
        
        worksheet.getCell(rowNumber, 2).value = ''; // Will be replaced with image
        worksheet.getCell(rowNumber, 2).alignment = cellAlignment;
        
        worksheet.getCell(rowNumber, 3).value = row.info_text || '';
        worksheet.getCell(rowNumber, 3).alignment = cellAlignment;
        
        worksheet.getCell(rowNumber, 4).value = row.tag || '';
        worksheet.getCell(rowNumber, 4).alignment = cellAlignment;
        
        worksheet.getCell(rowNumber, 5).value = row.model_result ? 'TRUE' : 'FALSE';
        worksheet.getCell(rowNumber, 5).alignment = cellAlignment;
        
        worksheet.getCell(rowNumber, 6).value = row.notes || '';
        worksheet.getCell(rowNumber, 6).alignment = cellAlignment;
      }

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

      // Add chart images based on schema version
      if (isV2) {
        // V2: Add both 30D and 60D charts
        const success30d = addChartImage(`${variantId}-30d`, 5); // Column F (0-indexed)
        const success60d = addChartImage(`${variantId}-60d`, 6); // Column G (0-indexed)
        
        if (!success30d) {
          worksheet.getCell(rowNumber, 6).value = 'Chart export failed';
        }
        if (!success60d) {
          worksheet.getCell(rowNumber, 7).value = 'Chart export failed';
        }
      } else {
        // Legacy: Add single chart
        const success = addChartImage(variantId, 1); // Column B (0-indexed)
        if (!success) {
          worksheet.getCell(rowNumber, 2).value = 'Chart export failed';
        }
      }

      // Apply alignment to cells with data only (vertical: middle, horizontal: center)
      // Column 1: variant_id
      if (row.variant_id) {
        worksheet.getCell(rowNumber, 1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      }
      
      // Column 2: chart - no text alignment (image only)
      
      // Column 3: informations
      if (row.info_text) {
        worksheet.getCell(rowNumber, 3).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      }
      
      // Column 4: pattern
      if (row.tag) {
        worksheet.getCell(rowNumber, 4).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      }
      
      // Column 5: model_result - always has value (TRUE/FALSE)
      worksheet.getCell(rowNumber, 5).alignment = { vertical: 'middle', horizontal: 'center' };
      
      // Column 6: notes
      if (row.notes) {
        worksheet.getCell(rowNumber, 6).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
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

