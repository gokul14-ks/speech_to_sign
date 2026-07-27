from django.urls import path
from . import views
from django.conf.urls.static import static
from django.conf import settings

urlpatterns = [
    path('index', views.index, name='index'),
    path('', views.login_view, name='login'),
    path('user-home',views.user_home,name='user_home'),
    path('user-profile',views.profile,name='user_profile'),
    path("register/", views.register, name="register"),
    path("adminhome/", views.admin_home, name="admin_home"),
    path("edit/<int:id>/", views.edit_video, name="edit_video"),
    path("delete/<int:id>/", views.delete_video, name="delete_video"),
    path("whisper-test/", views.whisper_test, name="whisper_test"),
    path("whisper/", views.whisper_view, name="whisper"),
]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)