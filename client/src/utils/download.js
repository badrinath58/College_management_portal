// Fetch a protected file with the login token and either show it or save it.
import api from '../services/api';

// "/api/files/answer-sheets/x.pdf" -> Blob   (the Axios base URL already ends with /api)
export async function fetchFileBlob(fileUrl, download = false) {
  const url = fileUrl.replace(/^\/api/, '') + (download ? '?download=true' : '');
  const res = await api.get(url, { responseType: 'blob' });
  return res.data;
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Downloads a PDF made by the server. The file name comes from the server's Content-Disposition header.
export async function downloadPdf(url, params, fallbackName = 'document.pdf') {
  const res = await api.get(url.replace(/^\/api/, ''), { params, responseType: 'blob' });
  const match = /filename="?([^";]+)"?/i.exec(res.headers['content-disposition'] || '');
  saveBlob(res.data, match ? match[1] : fallbackName);
}
