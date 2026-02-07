import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import api from '../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  Folder,
  Upload,
  Plus,
  Trash2,
  Download,
  Share2,
  MoreVertical,
  ChevronRight,
  Home,
  Search,
  Grid,
  List
} from 'lucide-react';

const fileIcons = {
  'application/vnd.oasis.opendocument.text': FileText,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileText,
  'application/msword': FileText,
  'application/vnd.oasis.opendocument.spreadsheet': FileSpreadsheet,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileSpreadsheet,
  'application/vnd.ms-excel': FileSpreadsheet,
  'application/vnd.oasis.opendocument.presentation': Presentation,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': Presentation,
  'application/vnd.ms-powerpoint': Presentation,
};

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function Dashboard() {
  const { folderId } = useParams();
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState([{ id: null, name: 'My Documents' }]);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (folderId) params.append('folderId', folderId);
      if (searchQuery) params.append('search', searchQuery);

      const response = await api.get(`/files?${params}`);
      setFiles(response.data.files);
      setFolders(response.data.folders);
    } catch (error) {
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [folderId, searchQuery]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const onDrop = useCallback(async (acceptedFiles) => {
    for (const file of acceptedFiles) {
      const formData = new FormData();
      formData.append('file', file);
      if (folderId) formData.append('folderId', folderId);

      try {
        await api.post('/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success(`Uploaded ${file.name}`);
      } catch (error) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    fetchFiles();
  }, [folderId, fetchFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    accept: {
      'application/vnd.oasis.opendocument.text': ['.odt'],
      'application/vnd.oasis.opendocument.spreadsheet': ['.ods'],
      'application/vnd.oasis.opendocument.presentation': ['.odp'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/msword': ['.doc'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.ms-powerpoint': ['.ppt'],
    }
  });

  const handleFileClick = (file) => {
    navigate(`/edit/${file.id}`);
  };

  const handleFolderClick = (folder) => {
    navigate(`/folder/${folder.id}`);
  };

  const handleDelete = async (e, file) => {
    e.stopPropagation();
    if (!confirm(`Delete "${file.name}"?`)) return;

    try {
      await api.delete(`/files/${file.id}`);
      toast.success('File deleted');
      fetchFiles();
    } catch (error) {
      toast.error('Failed to delete file');
    }
  };

  const handleDownload = async (e, file) => {
    e.stopPropagation();
    try {
      const response = await api.get(`/files/${file.id}/download`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download file');
    }
  };

  const handleCreateDocument = async (type) => {
    setShowNewMenu(false);
    const name = prompt(`Enter ${type} name:`);
    if (!name) return;

    try {
      const response = await api.post('/files/create', {
        name,
        type,
        folderId: folderId || null
      });
      toast.success('Document created');
      navigate(`/edit/${response.data.id}`);
    } catch (error) {
      toast.error('Failed to create document');
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      await api.post('/files/folder', {
        name: newFolderName,
        parentId: folderId || null
      });
      toast.success('Folder created');
      setShowNewFolderModal(false);
      setNewFolderName('');
      fetchFiles();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create folder');
    }
  };

  const FileIcon = ({ mimeType }) => {
    const Icon = fileIcons[mimeType] || FileText;
    return <Icon className="h-12 w-12 text-primary-500" />;
  };

  return (
    <div {...getRootProps()} className="min-h-[calc(100vh-180px)]">
      <input {...getInputProps()} />

      {/* Drag overlay */}
      {isDragActive && (
        <div className="fixed inset-0 bg-primary-500 bg-opacity-20 z-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-xl shadow-xl text-center">
            <Upload className="h-16 w-16 text-primary-500 mx-auto mb-4" />
            <p className="text-xl font-medium text-gray-700">Drop files to upload</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Documents</h1>
          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-1 text-sm text-gray-500 mt-1">
            <button onClick={() => navigate('/')} className="hover:text-primary-600">
              <Home className="h-4 w-4" />
            </button>
            {breadcrumbs.slice(1).map((crumb, index) => (
              <span key={crumb.id} className="flex items-center">
                <ChevronRight className="h-4 w-4 mx-1" />
                <button onClick={() => navigate(crumb.id ? `/folder/${crumb.id}` : '/')} className="hover:text-primary-600">
                  {crumb.name}
                </button>
              </span>
            ))}
          </nav>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent w-full sm:w-64"
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-primary-50 text-primary-600' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <Grid className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-primary-50 text-primary-600' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <List className="h-5 w-5" />
            </button>
          </div>

          {/* New button */}
          <div className="relative">
            <button
              onClick={() => setShowNewMenu(!showNewMenu)}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span>New</span>
            </button>

            {showNewMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                <div className="py-2">
                  <button
                    onClick={() => handleCreateDocument('document')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                  >
                    <FileText className="h-5 w-5 text-blue-500" />
                    <span>Document</span>
                  </button>
                  <button
                    onClick={() => handleCreateDocument('spreadsheet')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                  >
                    <FileSpreadsheet className="h-5 w-5 text-green-500" />
                    <span>Spreadsheet</span>
                  </button>
                  <button
                    onClick={() => handleCreateDocument('presentation')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                  >
                    <Presentation className="h-5 w-5 text-orange-500" />
                    <span>Presentation</span>
                  </button>
                  <hr className="my-2" />
                  <button
                    onClick={() => { setShowNewMenu(false); setShowNewFolderModal(true); }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                  >
                    <Folder className="h-5 w-5 text-yellow-500" />
                    <span>Folder</span>
                  </button>
                  <hr className="my-2" />
                  <label className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2 cursor-pointer">
                    <Upload className="h-5 w-5 text-gray-500" />
                    <span>Upload file</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) {
                          onDrop(Array.from(e.target.files));
                        }
                        setShowNewMenu(false);
                      }}
                      multiple
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {/* Empty state */}
          {files.length === 0 && folders.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-gray-300">
              <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h3>
              <p className="text-gray-500 mb-6">Get started by creating a new document or uploading a file</p>
              <button
                onClick={() => setShowNewMenu(true)}
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create document
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            /* Grid View */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {/* Folders */}
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  onClick={() => handleFolderClick(folder)}
                  className="bg-white rounded-xl p-4 border border-gray-200 hover:border-primary-300 hover:shadow-md cursor-pointer transition-all group"
                >
                  <div className="flex justify-center mb-3">
                    <Folder className="h-12 w-12 text-yellow-500" />
                  </div>
                  <p className="text-sm font-medium text-gray-900 text-center truncate">{folder.name}</p>
                </div>
              ))}

              {/* Files */}
              {files.map((file) => (
                <div
                  key={file.id}
                  onClick={() => handleFileClick(file)}
                  className="bg-white rounded-xl p-4 border border-gray-200 hover:border-primary-300 hover:shadow-md cursor-pointer transition-all group relative"
                >
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex space-x-1">
                      <button
                        onClick={(e) => handleDownload(e, file)}
                        className="p-1 bg-gray-100 rounded hover:bg-gray-200"
                        title="Download"
                      >
                        <Download className="h-4 w-4 text-gray-600" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, file)}
                        className="p-1 bg-gray-100 rounded hover:bg-red-100"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-gray-600 hover:text-red-600" />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-center mb-3">
                    <FileIcon mimeType={file.mimeType} />
                  </div>
                  <p className="text-sm font-medium text-gray-900 text-center truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500 text-center mt-1">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            /* List View */
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Modified</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {folders.map((folder) => (
                    <tr
                      key={folder.id}
                      onClick={() => handleFolderClick(folder)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Folder className="h-8 w-8 text-yellow-500 mr-3" />
                          <span className="text-sm font-medium text-gray-900">{folder.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">—</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(folder.updatedAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right"></td>
                    </tr>
                  ))}
                  {files.map((file) => (
                    <tr
                      key={file.id}
                      onClick={() => handleFileClick(file)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FileIcon mimeType={file.mimeType} />
                          <span className="text-sm font-medium text-gray-900 ml-3">{file.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatFileSize(file.size)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(file.updatedAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={(e) => handleDownload(e, file)}
                          className="text-gray-400 hover:text-gray-600 mr-2"
                        >
                          <Download className="h-5 w-5" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, file)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Folder</h3>
            <form onSubmit={handleCreateFolder}>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-4"
                autoFocus
              />
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => { setShowNewFolderModal(false); setNewFolderName(''); }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Click outside to close menu */}
      {showNewMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowNewMenu(false)}
        />
      )}
    </div>
  );
}
