// src/components/SkeletonProvider.tsx
import { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

interface Props {
  children: React.ReactNode;
}

export default function SkeletonProvider({ children }: Props) {
  return (
    <SkeletonTheme
      baseColor="#252538"      // más claro que bg-[#1a1a2e] para ser visible
      highlightColor="#3d3d5c" // shimmer más claro
      duration={1.2}
    >
      {children}
    </SkeletonTheme>
  );
}