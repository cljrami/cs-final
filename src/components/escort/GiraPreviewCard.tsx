import { format, isValid, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  ciudadNombre: string;
  fechaInicio: string;
  fechaFin: string;
  ciudadBase: string;
}

export default function GiraPreviewCard({ ciudadNombre, fechaInicio, fechaFin, ciudadBase }: Props) {
  if (!ciudadNombre || !fechaInicio || !fechaFin) {
    return null;
  }

  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);

  if (!isValid(inicio) || !isValid(fin)) {
    return null;
  }

  const dias = differenceInDays(fin, inicio) + 1;
  const inicioStr = format(inicio, 'dd MMM', { locale: es });
  const finStr = format(fin, 'dd MMM yyyy', { locale: es });
  const inicioDiaRaw = format(inicio, 'EEEE', { locale: es });
  const finDiaRaw = format(fin, 'EEEE', { locale: es });

  // Short day names
  const diasSemana = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const inicioNum = inicio.getDay();
  const finNum = fin.getDay();

  // Build day string like "L–D" or "L–M"
  const dayStr = inicioNum <= finNum
    ? `${diasSemana[inicioNum]}–${diasSemana[finNum]}`
    : `${diasSemana[inicioNum]}→${diasSemana[finNum]} (cruza fin de semana)`;

  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 border border-purple-500/30 rounded-xl p-4 mt-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-fuchsia-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0">
          <i className="fas fa-plane-departure text-white text-lg"></i>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-white">{ciudadNombre}</span>
            <span className="text-gray-500">•</span>
            <span className={`text-xs font-medium ${
              dias > 30 ? 'text-amber-400' : dias > 60 ? 'text-red-400' : 'text-purple-300'
            }`}>
              {dias} {dias === 1 ? 'día' : 'días'}
            </span>
            <span className="text-xs text-gray-500 bg-gray-800/50 px-1.5 py-0.25 rounded">
              {dayStr}
            </span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {inicioStr} → {finStr}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            <i className="fas fa-city mr-1"></i> Volverás a {ciudadBase || 'tu ciudad base'}
          </div>
        </div>
      </div>
    </div>
  );
}
