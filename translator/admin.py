from django.contrib import admin
# from .models import YourModel

# admin.site.register(YourModel)
# Register your models here.
from .models import *

admin.site.register(User)
admin.site.register(SignVideo)
admin.site.register(TranslationHistory)