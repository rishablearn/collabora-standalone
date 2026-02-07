import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Download, Share2 } from 'lucide-react';

export default function Editor() {
  const { fileId } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [editUrl, setEditUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEditUrl = async () => {
      try {
        const response = await api.get(`/files/${fileId}/edit`);
        setFile({
          id: fileId,
          name: response.data.fileName,
          permission: response.data.permission
        });
        setEditUrl(response.data.editUrl);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load document');
        toast.error('Failed to load document');
      } finally {
        setLoading(false);
      }
    };

    fetchEditUrl();
  }, [fileId]);

  const handleDownload = async () => {
    try {
      const response = await api.get(`/files/${fileId}/download`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = file?.name || 'document';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Failed to download file');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Document</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Back to Documents
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 h-16 flex items-center px-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
        >
          <ArrowLeft className="h-5 w-5 mr-1" />
          <span className="hidden sm:inline">Back</span>
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-medium text-gray-900 truncate">
            {file?.name || 'Document'}
          </h1>
          <p className="text-xs text-gray-500">
            {file?.permission === 'edit' ? 'Editing' : 'View only'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleDownload}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            title="Download"
          >
            <Download className="h-5 w-5" />
          </button>
          <button
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            title="Share"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Collabora iframe */}
      <div className="flex-1">
        {editUrl && (
          <iframe
            src={editUrl}
            className="collabora-frame"
            title="Collabora Online Editor"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
            allow="clipboard-read; clipboard-write"
          />
        )}
      </div>
    </div>
  );
}
