import iconMySQL from '@/assets/imgs/datasource/service-icon-mysql.png';
import iconPostgreSQL from '@/assets/imgs/datasource/service-icon-postgresql.png';
import iconOracle from '@/assets/imgs/datasource/service-icon-oracle.png';
import iconClickHouse from '@/assets/imgs/datasource/service-icon-clickhouse.png';
import iconHive from '@/assets/imgs/datasource/service-icon-hive.png';
import iconDoris from '@/assets/imgs/datasource/service-icon-doris.png';
import iconGreenplum from '@/assets/imgs/datasource/service-icon-greenplum.png';
import iconMariaDB from '@/assets/imgs/datasource/service-icon-mariadb.png';
import iconSQLite from '@/assets/imgs/datasource/service-icon-sqlite.png';
import iconStarRocks from '@/assets/imgs/datasource/service-icon-starrocks.png';
import iconVertica from '@/assets/imgs/datasource/service-icon-vertica.png';
import iconGeneric from '@/assets/imgs/datasource/service-icon-generic.png';

const iconMap: Record<string, string> = {
  mysql: iconMySQL,
  postgresql: iconPostgreSQL,
  oracle: iconOracle,
  clickhouse: iconClickHouse,
  hive: iconHive,
  doris: iconDoris,
  greenplum: iconGreenplum,
  mariadb: iconMariaDB,
  sqlite: iconSQLite,
  starrocks: iconStarRocks,
  vertica: iconVertica
};

/**
 * 根据数据源类型获取品牌图标 URL
 * @param type 数据源类型 key（如 'mysql'、'postgresql'）
 * @returns 图标的 import URL
 */
export function getDatasourceIcon(type?: string | null): string {
  return iconMap[type?.toLowerCase() ?? ''] ?? iconGeneric;
}

