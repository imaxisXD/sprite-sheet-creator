'use client';

import { useState, useCallback, useRef } from 'react';
import {
  analyzeGridFromImage,
  extractFramesFromSpriteSheet,
  GRID_RECOMMENDATIONS,
  getAllRecommendations,
  validateSpriteSheet,
  STANDARD_FRAME_SIZE,
  GridAnalysisResult,
  GridRecommendation,
} from '../utils/grid-analyzer';

interface ExtractedFrame {
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FrameExtractorProps {
  onFramesExtracted?: (frames: ExtractedFrame[], config: {
    columns: number;
    rows: number;
    frameWidth: number;
    frameHeight: number;
    animationType: string;
  }) => void;
}

export default function FrameExtractor({ onFramesExtracted }: FrameExtractorProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [analysis, setAnalysis] = useState<GridAnalysisResult | null>(null);
  const [selectedType, setSelectedType] = useState<string>('');
  const [customColumns, setCustomColumns] = useState<number>(4);
  const [customRows, setCustomRows] = useState<number>(4);
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrame[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setExtractedFrames([]);
    setAnalysis(null);

    // Get image dimensions
    const img = new Image();
    img.onload = () => {
      setImageDimensions({ width: img.width, height: img.height });
    };
    img.src = url;
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!imageUrl) return;

    setIsAnalyzing(true);
    try {
      const result = await analyzeGridFromImage(imageUrl, selectedType || undefined);
      setAnalysis(result);
      setCustomColumns(result.detectedColumns);
      setCustomRows(result.detectedRows);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [imageUrl, selectedType]);

  const handleExtract = useCallback(async () => {
    if (!imageUrl) return;

    setIsExtracting(true);
    try {
      const { frames, frameWidth, frameHeight } = await extractFramesFromSpriteSheet(
        imageUrl,
        customColumns,
        customRows
      );
      setExtractedFrames(frames);

      if (onFramesExtracted) {
        onFramesExtracted(frames, {
          columns: customColumns,
          rows: customRows,
          frameWidth,
          frameHeight,
          animationType: selectedType || 'custom',
        });
      }
    } catch (error) {
      console.error('Extraction failed:', error);
    } finally {
      setIsExtracting(false);
    }
  }, [imageUrl, customColumns, customRows, selectedType, onFramesExtracted]);

  const handleTypeSelect = useCallback((type: string) => {
    setSelectedType(type);
    const config = GRID_RECOMMENDATIONS[type];
    if (config) {
      setCustomColumns(config.recommendedColumns);
      setCustomRows(config.recommendedRows);
    }
  }, []);

  const validation = imageDimensions && selectedType
    ? validateSpriteSheet(imageDimensions.width, imageDimensions.height, selectedType)
    : null;

  const recommendations = getAllRecommendations();

  return (
    <div className="frame-extractor">
      <style jsx>{`
        .frame-extractor {
          padding: 20px;
          background: #1a1a2e;
          border-radius: 12px;
          color: #e0e0e0;
        }

        .section {
          margin-bottom: 24px;
        }

        .section-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 12px;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .upload-area {
          border: 2px dashed #444;
          border-radius: 8px;
          padding: 40px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .upload-area:hover {
          border-color: #667eea;
          background: rgba(102, 126, 234, 0.1);
        }

        .preview-container {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }

        .image-preview {
          max-width: 300px;
          border-radius: 8px;
          border: 1px solid #333;
        }

        .type-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 10px;
        }

        .type-card {
          padding: 12px;
          background: #252540;
          border: 2px solid transparent;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .type-card:hover {
          background: #2d2d4a;
        }

        .type-card.selected {
          border-color: #667eea;
          background: rgba(102, 126, 234, 0.2);
        }

        .type-name {
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 4px;
        }

        .type-info {
          font-size: 12px;
          color: #888;
        }

        .config-row {
          display: flex;
          gap: 16px;
          align-items: center;
          margin-bottom: 12px;
        }

        .config-input {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .config-input label {
          font-size: 12px;
          color: #888;
        }

        .config-input input {
          width: 80px;
          padding: 8px;
          background: #252540;
          border: 1px solid #444;
          border-radius: 6px;
          color: #fff;
          font-size: 14px;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: #fff;
        }

        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .btn-secondary {
          background: #333;
          color: #fff;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .analysis-result {
          padding: 16px;
          background: #252540;
          border-radius: 8px;
          margin-top: 16px;
        }

        .analysis-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .confidence-badge {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }

        .confidence-high {
          background: rgba(46, 213, 115, 0.2);
          color: #2ed573;
        }

        .confidence-medium {
          background: rgba(255, 171, 64, 0.2);
          color: #ffab40;
        }

        .confidence-low {
          background: rgba(255, 71, 87, 0.2);
          color: #ff4757;
        }

        .warning-list, .recommendation-list {
          list-style: none;
          padding: 0;
          margin: 8px 0;
        }

        .warning-list li {
          color: #ffab40;
          font-size: 13px;
          padding: 4px 0;
        }

        .recommendation-list li {
          color: #2ed573;
          font-size: 13px;
          padding: 4px 0;
        }

        .validation-result {
          padding: 12px;
          border-radius: 8px;
          margin-top: 12px;
        }

        .validation-valid {
          background: rgba(46, 213, 115, 0.1);
          border: 1px solid rgba(46, 213, 115, 0.3);
        }

        .validation-invalid {
          background: rgba(255, 71, 87, 0.1);
          border: 1px solid rgba(255, 71, 87, 0.3);
        }

        .frames-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
          gap: 8px;
          padding: 16px;
          background: #252540;
          border-radius: 8px;
          max-height: 400px;
          overflow-y: auto;
        }

        .frame-item {
          aspect-ratio: 2/3;
          background: #333;
          border-radius: 4px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .frame-item img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          image-rendering: pixelated;
        }

        .frame-index {
          position: absolute;
          bottom: 2px;
          right: 2px;
          background: rgba(0,0,0,0.7);
          color: #fff;
          font-size: 10px;
          padding: 2px 4px;
          border-radius: 2px;
        }

        .recommendations-panel {
          background: #252540;
          border-radius: 8px;
          padding: 16px;
          margin-top: 16px;
        }

        .rec-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .rec-table th, .rec-table td {
          padding: 8px;
          text-align: left;
          border-bottom: 1px solid #333;
        }

        .rec-table th {
          color: #888;
          font-weight: 500;
        }

        .rec-table tr:hover td {
          background: rgba(102, 126, 234, 0.1);
        }

        .tag {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          margin-left: 8px;
        }

        .tag-directional {
          background: rgba(102, 126, 234, 0.2);
          color: #667eea;
        }

        .tag-combat {
          background: rgba(255, 71, 87, 0.2);
          color: #ff4757;
        }
      `}</style>

      <h2 style={{ marginBottom: 20, fontSize: 20 }}>Frame Extractor & Grid Analyzer</h2>

      {/* Upload Section */}
      <div className="section">
        <div className="section-title">
          1. Upload Sprite Sheet
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          style={{ display: 'none' }}
        />
        <div
          className="upload-area"
          onClick={() => fileInputRef.current?.click()}
        >
          {imageUrl ? (
            <div className="preview-container">
              <img src={imageUrl} alt="Uploaded sprite sheet" className="image-preview" />
              {imageDimensions && (
                <div style={{ textAlign: 'left' }}>
                  <p><strong>Dimensions:</strong> {imageDimensions.width} × {imageDimensions.height}px</p>
                  <p><strong>Standard frame size:</strong> {STANDARD_FRAME_SIZE.width} × {STANDARD_FRAME_SIZE.height}px</p>
                  <p><strong>Possible columns:</strong> {Math.floor(imageDimensions.width / STANDARD_FRAME_SIZE.width)}</p>
                  <p><strong>Possible rows:</strong> {Math.floor(imageDimensions.height / STANDARD_FRAME_SIZE.height)}</p>
                </div>
              )}
            </div>
          ) : (
            <p>Click or drag to upload a sprite sheet image</p>
          )}
        </div>
      </div>

      {/* Animation Type Selection */}
      <div className="section">
        <div className="section-title">
          2. Select Animation Type
          <button
            className="btn btn-secondary"
            style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: 12 }}
            onClick={() => setShowRecommendations(!showRecommendations)}
          >
            {showRecommendations ? 'Hide' : 'Show'} Recommendations
          </button>
        </div>

        {showRecommendations && (
          <div className="recommendations-panel">
            <table className="rec-table">
              <thead>
                <tr>
                  <th>Animation</th>
                  <th>Grid</th>
                  <th>Frames</th>
                  <th>Size</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.map((rec) => (
                  <tr key={rec.animationType}>
                    <td>
                      {rec.animationType}
                      <span className={`tag ${rec.isDirectional ? 'tag-directional' : 'tag-combat'}`}>
                        {rec.isDirectional ? '4-dir' : 'single'}
                      </span>
                    </td>
                    <td>{rec.recommendedColumns} × {rec.recommendedRows}</td>
                    <td>{rec.frameCount}</td>
                    <td>{rec.targetFrameSize.width}×{rec.targetFrameSize.height}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="type-grid" style={{ marginTop: 16 }}>
          {Object.entries(GRID_RECOMMENDATIONS).map(([type, config]) => (
            <div
              key={type}
              className={`type-card ${selectedType === type ? 'selected' : ''}`}
              onClick={() => handleTypeSelect(type)}
            >
              <div className="type-name">{type}</div>
              <div className="type-info">
                {config.recommendedColumns}×{config.recommendedRows} ({config.frameCount} frames)
              </div>
            </div>
          ))}
        </div>

        {validation && (
          <div className={`validation-result ${validation.isValid ? 'validation-valid' : 'validation-invalid'}`}>
            {validation.isValid ? (
              <span>Image dimensions match {selectedType} configuration</span>
            ) : (
              <>
                <strong>Dimension mismatch:</strong>
                <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                  {validation.errors.map((err, i) => (
                    <li key={i} style={{ color: '#ff4757', fontSize: 13 }}>{err}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      {/* Grid Configuration */}
      <div className="section">
        <div className="section-title">
          3. Grid Configuration
        </div>
        <div className="config-row">
          <div className="config-input">
            <label>Columns</label>
            <input
              type="number"
              min={1}
              value={customColumns}
              onChange={(e) => setCustomColumns(parseInt(e.target.value) || 1)}
            />
          </div>
          <div className="config-input">
            <label>Rows</label>
            <input
              type="number"
              min={1}
              value={customRows}
              onChange={(e) => setCustomRows(parseInt(e.target.value) || 1)}
            />
          </div>
          <button
            className="btn btn-secondary"
            onClick={handleAnalyze}
            disabled={!imageUrl || isAnalyzing}
          >
            {isAnalyzing ? 'Analyzing...' : 'Auto-Detect Grid'}
          </button>
        </div>

        {analysis && (
          <div className="analysis-result">
            <div className="analysis-header">
              <span>Analysis Result</span>
              <span
                className={`confidence-badge ${
                  analysis.confidence > 0.8
                    ? 'confidence-high'
                    : analysis.confidence > 0.5
                    ? 'confidence-medium'
                    : 'confidence-low'
                }`}
              >
                {Math.round(analysis.confidence * 100)}% confidence
              </span>
            </div>
            <p>
              <strong>Detected:</strong> {analysis.detectedColumns} columns × {analysis.detectedRows} rows
              ({analysis.frameWidth}×{analysis.frameHeight}px per frame)
            </p>
            {analysis.warnings.length > 0 && (
              <ul className="warning-list">
                {analysis.warnings.map((w, i) => (
                  <li key={i}>&#9888; {w}</li>
                ))}
              </ul>
            )}
            {analysis.recommendations.length > 0 && (
              <ul className="recommendation-list">
                {analysis.recommendations.map((r, i) => (
                  <li key={i}>&#10003; {r}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Extract Button */}
      <div className="section">
        <button
          className="btn btn-primary"
          onClick={handleExtract}
          disabled={!imageUrl || isExtracting}
          style={{ width: '100%' }}
        >
          {isExtracting ? 'Extracting Frames...' : `Extract ${customColumns * customRows} Frames`}
        </button>
      </div>

      {/* Extracted Frames */}
      {extractedFrames.length > 0 && (
        <div className="section">
          <div className="section-title">
            Extracted Frames ({extractedFrames.length})
          </div>
          <div className="frames-grid">
            {extractedFrames.map((frame, index) => (
              <div key={index} className="frame-item" style={{ position: 'relative' }}>
                <img src={frame.dataUrl} alt={`Frame ${index}`} />
                <span className="frame-index">{index}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
