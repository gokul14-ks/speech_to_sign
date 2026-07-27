from django.db import models

# Create your models here.
class User(models.Model):

    ROLE_CHOICES = [
        ('Admin', 'Admin'),
        ('User', 'User'),
    ]

    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=255)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

class SignVideo(models.Model):
    word = models.CharField(max_length=100, unique=True)
    video = models.FileField(upload_to="sign_videos/")

    def __str__(self):
        return self.word

class TranslationHistory(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    speech_text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.speech_text