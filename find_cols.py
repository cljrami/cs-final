with open('src/components/admin/SuscripcionesData.tsx') as f:
    lines = f.read().splitlines()
for i, l in enumerate(lines):
    if 'key:' in l and 'header' in lines[i+1] if i+1 < len(lines) else False:
        print(i+1, l.strip()[:120])
