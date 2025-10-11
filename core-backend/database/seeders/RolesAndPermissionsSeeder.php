<?php
namespace Database\Seeders;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use App\Models\User;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Optionally, create specific permissions
        // Permission::create(['name' => 'edit articles']);

        // Create the 'admin' and 'user' roles
        $adminRole = Role::create(['name' => 'admin']);
        $doctorRole = Role::create(['name' => 'doctor']);
        $patientRole = Role::create(['name' => 'patient']);

        // Assign permissions to roles if needed
        // $adminRole->givePermissionTo('edit articles');

        // Create a default admin user (optional but recommended)
        $adminUser = User::factory()->create([
            'name' => 'admin',
            'email' => 'admin@example.com',
            'password' => '12345678'
        ]);
        $adminUser->assignRole($adminRole);
    }
}