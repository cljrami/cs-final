with open('src/components/escort/OnboardingTour.tsx','r',encoding='utf-8',errors='ignore') as f:
    content = f.read()
content = content.replace('Para poder editar tu perfil, subir fotos y usar tu panel, primero debes seleccionar tu plan. El resto de las opciones se habilitarán cuando el administrador apruebe tu solicitud.', '¡Bienvenida a tu panel! Empecemos por lo más importante.')
content = content.replace('Selecciona tu plan', '')
content = content.replace('Elige el plan con el que quieras publicar. Al aprobarlo, tu panel se habilitará.', '')
with open('src/components/escort/OnboardingTour.tsx','w',encoding='utf-8') as f:
    f.write(content)
print('cleaned')
