import { type FC } from 'react';

interface FilterTab {
  key: string;
  label: string;
  icon?: string;
}

interface SearchFiltersProps {
  search: string;
  onSearch: (value: string) => void;
  placeholder?: string;
  filters: FilterTab[];
  activeFilter: string;
  onFilterChange: (key: string) => void;
  hideSearch?: boolean;
}

const SearchFilters: FC<SearchFiltersProps> = ({
  search,
  onSearch,
  placeholder = 'Buscar...',
  filters,
  activeFilter,
  onFilterChange,
  hideSearch = false,
}) => {
  return (
    <div>
      {!hideSearch && (
        <div className="relative mb-3">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
          <input
            type="text"
            placeholder={placeholder}
            value={search}
            onChange={e => onSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-admin-card border border-admin-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-admin-primary transition-colors"
          />
        </div>
      )}
      {filters.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => onFilterChange(f.key)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap flex-shrink-0 ${
                activeFilter === f.key
                  ? 'bg-admin-primary text-white shadow-lg shadow-admin-primary/20'
                  : 'bg-admin-border text-gray-300 hover:bg-gray-700'
              }`}
            >
              {f.icon && <i className={`fas ${f.icon} mr-1.5`}></i>}
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchFilters;
