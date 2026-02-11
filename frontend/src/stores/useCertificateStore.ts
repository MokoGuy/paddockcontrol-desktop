import { create } from 'zustand';
import { CertificateListItem } from '../types';

interface CertificateState {
  certificates: CertificateListItem[];
  setCertificates: (certificates: CertificateListItem[]) => void;
  addCertificate: (certificate: CertificateListItem) => void;
  removeCertificate: (hostname: string) => void;
  updateCertificate: (hostname: string, certificate: CertificateListItem) => void;
  clearCertificates: () => void;
}

export const useCertificateStore = create<CertificateState>((set) => ({
  certificates: [],

  setCertificates: (certificates) => set({ certificates }),

  addCertificate: (certificate) =>
    set((state) => ({
      certificates: [...state.certificates, certificate],
    })),

  removeCertificate: (hostname) =>
    set((state) => ({
      certificates: state.certificates.filter((c) => c.hostname !== hostname),
    })),

  updateCertificate: (hostname, certificate) =>
    set((state) => ({
      certificates: state.certificates.map((c) =>
        c.hostname === hostname ? certificate : c
      ),
    })),

  clearCertificates: () => set({ certificates: [] }),
}));
