with open('public/api/escort/login.php','r',encoding='utf-8',errors='ignore') as f: lines=f.read().splitlines()
for i,line in enumerate(lines):
    if 'Tu cuenta fue eliminada' in line:
        lines[i] = "            'mensaje' => 'Tu cuenta fue eliminada. Para volver a publicar, registrate con el mismo email: se reactivara automaticamente y deberas elegir un plan de pago.',"
        break
with open('public/api/escort/login.php','w',encoding='utf-8') as f: f.write('\n'.join(lines)+'\n')
print('fixed')
