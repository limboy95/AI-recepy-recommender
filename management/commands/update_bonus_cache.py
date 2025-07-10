from django.core.management.base import BaseCommand
from shopping.ah_bonus_scraper import update_ah_bonus_cache

class Command(BaseCommand):
    help = 'Update AH bonus cache from website'

    def handle(self, *args, **options):
        try:
            count = update_ah_bonus_cache()
            self.stdout.write(
                self.style.SUCCESS(f'Successfully updated {count} bonus items')
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error updating bonus cache: {e}')
            )