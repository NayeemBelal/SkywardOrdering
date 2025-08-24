import React from 'react';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';

interface ImportRow {
  siteLocation: string;
  itemSku: string;
  itemName: string;
  type: string;
  rowNumber: number;
}

interface ValidationError {
  rowNumber: number;
  field: string;
  message: string;
}

interface ImageFile {
  file: File;
  sku: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: ImportRow[], images: ImageFile[]) => Promise<void>;
  siteName?: string; // For validation when importing to existing site
}

export default function BulkImportModal({ isOpen, onClose, onImport, siteName }: BulkImportModalProps) {
  const { t } = useTranslation();
  const [file, setFile] = React.useState<File | null>(null);
  const [parsedData, setParsedData] = React.useState<ImportRow[]>([]);
  const [errors, setErrors] = React.useState<ValidationError[]>([]);
  const [importing, setImporting] = React.useState(false);
  const [step, setStep] = React.useState<'upload' | 'preview' | 'images'>('upload');
  const [imageFiles, setImageFiles] = React.useState<ImageFile[]>([]);
  const [imageErrors, setImageErrors] = React.useState<string[]>([]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);

  const resetModal = () => {
    setFile(null);
    setParsedData([]);
    setErrors([]);
    setStep('upload');
    setImporting(false);
    setImageFiles([]);
    setImageErrors([]);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const validateFileType = (file: File): boolean => {
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/csv'
    ];
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    
    const hasValidType = allowedTypes.includes(file.type);
    const hasValidExtension = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    return hasValidType || hasValidExtension;
  };

  const parseFile = async (file: File): Promise<ImportRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          let workbook: XLSX.WorkBook;
          
          if (file.name.toLowerCase().endsWith('.csv')) {
            workbook = XLSX.read(data, { type: 'binary' });
          } else {
            workbook = XLSX.read(data, { type: 'array' });
          }
          
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          
          // Skip empty rows and header row
          const dataRows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''));
          
          const parsed: ImportRow[] = dataRows.map((row, index) => ({
            siteLocation: String(row[0] || '').trim(),
            itemSku: String(row[1] || '').trim(),
            itemName: String(row[2] || '').trim(),
            type: String(row[3] || '').trim().toLowerCase(),
            rowNumber: index + 2 // +2 because we skipped header and arrays are 0-indexed
          }));
          
          resolve(parsed);
        } catch (error) {
          reject(new Error('Failed to parse file. Please ensure it\'s a valid Excel or CSV file.'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      if (file.name.toLowerCase().endsWith('.csv')) {
        reader.readAsBinaryString(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  };

  const validateData = (data: ImportRow[]): ValidationError[] => {
    const validationErrors: ValidationError[] = [];
    const validTypes = ['consumable', 'supply', 'equipment'];
    
    data.forEach((row) => {
      // Check required fields
      if (!row.siteLocation) {
        validationErrors.push({
          rowNumber: row.rowNumber,
          field: 'Site Location',
          message: 'Site location is required'
        });
      }
      
      if (!row.itemSku) {
        validationErrors.push({
          rowNumber: row.rowNumber,
          field: 'Item SKU',
          message: 'Item SKU is required'
        });
      }
      
      if (!row.itemName) {
        validationErrors.push({
          rowNumber: row.rowNumber,
          field: 'Item Name',
          message: 'Item name is required'
        });
      }
      
      if (!row.type) {
        validationErrors.push({
          rowNumber: row.rowNumber,
          field: 'Type',
          message: 'Type is required'
        });
      } else if (!validTypes.includes(row.type)) {
        validationErrors.push({
          rowNumber: row.rowNumber,
          field: 'Type',
          message: `Type must be one of: ${validTypes.join(', ')}`
        });
      }
      
      // Validate site name matches if importing to existing site
      if (siteName && row.siteLocation.toLowerCase() !== siteName.toLowerCase()) {
        validationErrors.push({
          rowNumber: row.rowNumber,
          field: 'Site Location',
          message: `Site location "${row.siteLocation}" doesn't match current site "${siteName}"`
        });
      }
    });
    
    return validationErrors;
  };

  const handleFileSelect = async (selectedFile: File) => {
    if (!validateFileType(selectedFile)) {
      setErrors([{
        rowNumber: 0,
        field: 'File',
        message: 'Invalid file type. Please upload an Excel (.xlsx, .xls) or CSV file.'
      }]);
      return;
    }
    
    setFile(selectedFile);
    setErrors([]);
    
    try {
      const parsed = await parseFile(selectedFile);
      const validationErrors = validateData(parsed);
      
      setParsedData(parsed);
      setErrors(validationErrors);
      setStep('preview');
    } catch (error: any) {
      setErrors([{
        rowNumber: 0,
        field: 'File',
        message: error.message
      }]);
    }
  };

  const extractSkuFromFilename = (filename: string): string => {
    // Remove extension and get the SKU
    return filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
  };

  const handleImageSelect = (selectedFiles: FileList) => {
    setImageErrors([]);
    const newImages: ImageFile[] = [];
    const errors: string[] = [];
    
    Array.from(selectedFiles).forEach(file => {
      // Check file type
      if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/i)) {
        errors.push(`${file.name}: Invalid file type. Only JPG, PNG, and WEBP are supported.`);
        return;
      }
      
      const sku = extractSkuFromFilename(file.name);
      if (!sku) {
        errors.push(`${file.name}: Could not extract SKU from filename.`);
        return;
      }
      
      // Check if SKU matches any imported item
      const matchingItem = parsedData.find(item => item.itemSku.toLowerCase() === sku.toLowerCase());
      if (!matchingItem) {
        errors.push(`${file.name}: SKU "${sku}" does not match any imported items.`);
        return;
      }
      
      // Check for duplicates in current batch
      const existingImage = newImages.find(img => img.sku.toLowerCase() === sku.toLowerCase());
      if (existingImage) {
        errors.push(`${file.name}: Duplicate SKU "${sku}" already selected.`);
        return;
      }
      
      newImages.push({
        file,
        sku,
        status: 'pending'
      });
    });
    
    setImageFiles(prev => [...prev, ...newImages]);
    setImageErrors(errors);
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const proceedToImages = () => {
    if (errors.length > 0) return;
    setStep('images');
  };

  const handleImport = async () => {
    if (errors.length > 0) return;
    
    setImporting(true);
    try {
      await onImport(parsedData, imageFiles);
      handleClose();
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{t('bulk import items')}</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">{t('file format instructions')}</h3>
                <div className="text-sm text-blue-800 space-y-2">
                  <p>{t('excel format description')}</p>
                  <div className="bg-white border border-blue-200 rounded p-3 font-mono text-xs">
                    <div className="grid grid-cols-4 gap-4 font-semibold border-b pb-1">
                      <div>Column A: Site Location</div>
                      <div>Column B: Item SKU</div>
                      <div>Column C: Item Name</div>
                      <div>Column D: Type</div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 pt-1 text-gray-600">
                      <div>Main Campus</div>
                      <div>ABC123</div>
                      <div>Paper Towels</div>
                      <div>consumable</div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p><strong>{t('type values')}:</strong></p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li><code>consumable</code> - {t('items consumed during use')}</li>
                      <li><code>supply</code> - {t('reusable tools and equipment')}</li>
                      <li><code>equipment</code> - {t('large machinery and equipment')}</li>
                    </ul>
                  </div>
                  {siteName && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                      <p><strong>{t('note')}:</strong> {t('site validation message', { siteName })}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">{t('select file')}</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(file);
                      }}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      {t('choose file')}
                    </button>
                    <p className="text-sm text-gray-500 mt-2">
                      {t('supported formats')}: .xlsx, .xls, .csv
                    </p>
                  </div>
                </div>

                {errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-medium text-red-900 mb-2">{t('errors found')}</h4>
                    <ul className="text-sm text-red-800 space-y-1">
                      {errors.map((error, index) => (
                        <li key={index}>
                          {error.rowNumber > 0 && `Row ${error.rowNumber}, `}
                          {error.field}: {error.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">{t('preview import data')}</h3>
                <button
                  onClick={() => setStep('upload')}
                  className="text-blue-600 hover:text-blue-800"
                >
                  ← {t('back to upload')}
                </button>
              </div>

              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-medium text-red-900 mb-2">{t('validation errors')}</h4>
                  <ul className="text-sm text-red-800 space-y-1 max-h-32 overflow-y-auto">
                    {errors.map((error, index) => (
                      <li key={index}>
                        Row {error.rowNumber}, {error.field}: {error.message}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-red-800 mt-2">
                    {t('fix errors before importing')}
                  </p>
                </div>
              )}

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b">
                  <p className="text-sm text-gray-600">
                    {t('items to import')}: {parsedData.length}
                  </p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          {t('row')}
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          {t('site location')}
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          {t('sku')}
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          {t('item name')}
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          {t('type')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {parsedData.map((row, index) => {
                        const hasError = errors.some(e => e.rowNumber === row.rowNumber);
                        return (
                          <tr key={index} className={hasError ? 'bg-red-50' : ''}>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {row.rowNumber}
                            </td>
                            <td className="px-4 py-2 text-sm">
                              {row.siteLocation}
                            </td>
                            <td className="px-4 py-2 text-sm font-mono">
                              {row.itemSku}
                            </td>
                            <td className="px-4 py-2 text-sm">
                              {row.itemName}
                            </td>
                            <td className="px-4 py-2 text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                row.type === 'consumable' ? 'bg-red-100 text-red-800' :
                                row.type === 'supply' ? 'bg-blue-100 text-blue-800' :
                                row.type === 'equipment' ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {row.type}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {step === 'images' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">{t('import product images')}</h3>
                <button
                  onClick={() => setStep('preview')}
                  className="text-blue-600 hover:text-blue-800"
                >
                  ← {t('back to preview')}
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">{t('image import instructions')}</h4>
                <div className="text-sm text-blue-800 space-y-2">
                  <p>{t('image filename format')}</p>
                  <div className="bg-white border border-blue-200 rounded p-3 font-mono text-xs">
                    <div className="space-y-1">
                      <div>ABC123.png</div>
                      <div>XYZ789.jpg</div>
                      <div>DEF456.webp</div>
                    </div>
                  </div>
                  <p><strong>{t('supported image formats')}:</strong> JPG, PNG, WEBP</p>
                  <p><strong>{t('note')}:</strong> {t('image sku matching note')}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">{t('select images')}</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      multiple
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files) handleImageSelect(files);
                      }}
                      className="hidden"
                    />
                    <button
                      onClick={() => imageInputRef.current?.click()}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      {t('add images')}
                    </button>
                    <p className="text-sm text-gray-500 mt-2">
                      {t('click to select multiple images')}
                    </p>
                  </div>
                </div>

                {imageErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-medium text-red-900 mb-2">{t('image errors')}</h4>
                    <ul className="text-sm text-red-800 space-y-1 max-h-32 overflow-y-auto">
                      {imageErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {imageFiles.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b">
                      <p className="text-sm text-gray-600">
                        {t('selected images')}: {imageFiles.length}
                      </p>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      <table className="min-w-full">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              {t('filename')}
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              {t('extracted sku')}
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              {t('file size')}
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              {t('actions')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {imageFiles.map((imageFile, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 text-sm">
                                {imageFile.file.name}
                              </td>
                              <td className="px-4 py-2 text-sm font-mono">
                                {imageFile.sku}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-500">
                                {(imageFile.file.size / 1024).toFixed(1)} KB
                              </td>
                              <td className="px-4 py-2 text-sm">
                                <button
                                  onClick={() => removeImage(index)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  {t('remove')}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {imageFiles.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    {t('no images selected')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-end space-x-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            {t('cancel')}
          </button>
          {step === 'preview' && (
            <>
              <button
                onClick={() => handleImport()}
                disabled={errors.length > 0}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:bg-gray-100"
              >
                {t('skip images import only items')}
              </button>
              <button
                onClick={proceedToImages}
                disabled={errors.length > 0}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-300"
              >
                {t('next add images')}
              </button>
            </>
          )}
          {step === 'images' && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
            >
              {importing ? t('importing') : t('import items and images')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
