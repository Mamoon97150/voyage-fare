// Agency packages (build 6).
import { supabase } from '../supabase'
import { sqlNull } from './sql'

/** What a package covers: exactly these lines (they count 0 and say "in the package"). */
export async function setPackageCover(packageId: string, items: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_package_cover', { p_package_id: packageId, p_items: items })
  if (error) throw error
}

/** One line in a package, or out of it (null). */
export async function setItemPackage(itemId: string, packageId: string | null): Promise<void> {
  const { error } = await supabase.rpc('set_item_package', { p_item_id: itemId, p_package_id: sqlNull(packageId) })
  if (error) throw error
}
