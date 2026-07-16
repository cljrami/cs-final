// src/components/admin/PlanModal.tsx
import { useState, useEffect } from 'react';

export interface Plan {
  id: number;
  clave: string;
  valor: string;
  tipo: 'string' | 'int' | 'bool' | 'json';
  descripcion: string | null;
  created_at: string;
  updated_at: string;
}

interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: Plan | null;
  onSave: (plan: Partial<Plan>) => Promise<void>;
}

export default function PlanModal({ isOpen, onClose, plan, onSave }: PlanModalProps) {
  const [clave, setClave] = useState('');
  const [valor, setValor] = useState('');
  const [tipo, setTipo] = useState<'string' | 'int' | 'bool' | 'json'>('string');
  const [descripcion, setDescripcion] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (plan) {
      setClave(plan.clave);
      setValor(plan.valor || '');
      setTipo(plan.tipo);
      setDescripcion(plan.descripcion || '');
    } else {
      setClave('');
      setValor('');
      setTipo('string');
      setDescripcion('');
    }
    setErrors({});
  }, [plan, isOpen]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!clave.trim()) {
      newErrors.clave = 'La clave es obligatoria';
    } else if (!/^[a-zA-Z0-9_]+$/.test(clave.trim())) {
      newErrors.clave = 'Solo letras, números y guiones bajos';
    }

    if (!valor.trim() && tipo !== 'bool') {
      newErrors.valor = 'El valor es obligatorio';
    }

    if (!descripcion.trim()) {
      newErrors.descripcion = 'La descripción es obligatoria';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSave({
        id: plan?.id,
        clave: clave.trim(),
        valor: valor.trim(),
        tipo,
        descripcion: descripcion.trim() || null,
      });
      onClose();
    } catch (err) {
      console.error('Error guardando plan:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditing = !!plan;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            <i className={`fas ${isEditing ? 'fa-edit' : 'fa-plus-circle'} mr-2 text-indigo-500`}></i>
            {isEditing ? 'Editar Plan' : 'Nuevo Plan'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Clave */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Clave <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={clave}
              onChange={(e) => {
                setClave(e.target.value);
                if (errors.clave) setErrors((prev) => ({ ...prev, clave: '' }));
              }}
              disabled={isEditing}
              placeholder="ej: precio_vip_mensual"
              className={`w-full px-3 py-2 rounded-lg border text-sm transition-all focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800 dark:text-white ${
                errors.clave
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              } ${isEditing ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}`}
            />
            {errors.clave && (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <i className="fas fa-exclamation-circle"></i>
                {errors.clave}
              </p>
            )}
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tipo <span className="text-red-500">*</span>
            </label>
            <select
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value as 'string' | 'int' | 'bool' | 'json');
                if (errors.valor) setErrors((prev) => ({ ...prev, valor: '' }));
              }}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="string">String</option>
              <option value="int">Entero</option>
              <option value="bool">Booleano</option>
              <option value="json">JSON</option>
            </select>
          </div>

          {/* Valor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Valor <span className="text-red-500">*</span>
            </label>
            {tipo === 'bool' ? (
              <select
                value={valor}
                onChange={(e) => {
                  setValor(e.target.value);
                  if (errors.valor) setErrors((prev) => ({ ...prev, valor: '' }));
                }}
                className={`w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                  errors.valor ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                <option value="1">Verdadero (1)</option>
                <option value="0">Falso (0)</option>
              </select>
            ) : (
              <input
                type={tipo === 'int' ? 'number' : 'text'}
                value={valor}
                onChange={(e) => {
                  setValor(e.target.value);
                  if (errors.valor) setErrors((prev) => ({ ...prev, valor: '' }));
                }}
                placeholder={tipo === 'int' ? 'ej: 50000' : 'ej: Kimi'}
                className={`w-full px-3 py-2 rounded-lg border text-sm transition-all focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800 dark:text-white ${
                  errors.valor
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              />
            )}
            {errors.valor && (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <i className="fas fa-exclamation-circle"></i>
                {errors.valor}
              </p>
            )}
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descripción <span className="text-red-500">*</span>
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => {
                setDescripcion(e.target.value);
                if (errors.descripcion) setErrors((prev) => ({ ...prev, descripcion: '' }));
              }}
              rows={3}
              placeholder="Descripción del plan o configuración..."
              className={`w-full px-3 py-2 rounded-lg border text-sm transition-all resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800 dark:text-white ${
                errors.descripcion
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {errors.descripcion && (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <i className="fas fa-exclamation-circle"></i>
                {errors.descripcion}
              </p>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <i className="fas fa-times mr-1"></i> Cancelar
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Guardando...
              </>
            ) : (
              <>
                <i className="fas fa-save"></i> {isEditing ? 'Actualizar' : 'Crear'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}