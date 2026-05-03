<?php
/*
	File: visualcube.php
	Date: 02 Apr 2010
	Author(s): Conrad Rider (www.crider.co.uk)
	Contributors: Shotaro Makisumi <smakisumi@gmail.com>, Jaume Casado Ruiz <minterior@gmail.com>
	Description: Main script to generate cube images

	This file is part of VisualCube.

	VisualCube is free software: you can redistribute it and/or modify
	it under the terms of the GNU Lesser General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	VisualCube is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Lesser General Public License for more details.

	You should have received a copy of the GNU Lesser General Public License
	along with Foobar.  If not, see <http://www.gnu.org/licenses/>.

	Copyright (C) 2010 Conrad Rider

	TODO:
	* Automatic Permutation Arrows
	* Other puzzles

	CHANGES:
	(Version 0.5.5 to 0.5.6)
	* Modified options to attempt to fix rendering issues in ImageMagick v6.9.x
	(Version 0.5.4 to 0.5.5)
	* Changed to using style attribute to fix transparrancy issues
	(Version 0.5.3 to 0.5.4)
	* Added configurable DB host
	* Added configurable path to ImageMagick convert binary
	(Version 0.5.2 to 0.5.3)
	* Fixed links on API page
	* Changed default format to SVG, avoiding ImageMagick failures
	* Addressed PHP warnings and fixed typos in the code
	(Version 0.5.1 to 0.5.2)
	* Separate configuration file
	* Separate API definition file - easier to provide custom API page
	(Version 0.3.0 to 0.4.0)
	* Algs applicable to NxNxN cubes
	* Wider range of stage masks, with the ability to rotate them
	* Style variables configurable via cookies
	
  V0.6.1 modified by Ruimin Yan 2020.3.9
  * Add multiple stages.

  V0.6.2 modified by kira 2020.3.10
  * Fix bug when set view as transparent. Bug description: view=trans bottom layer's cross can't display, hidden by the stroke layer
  * Fix by adding an if-else condition. 修复bug: view=trans, bg=t时，B,L,D面的白格无法显示.

  V0.6.3 modified by Ruimin Yan 2020.3.10
  * Updated version of V0.6.2

  V0.6.4 modified by Ruimin Yan 2020.3.10
  * Add multiple stages.
	
	V0.6.5 by Kirahan 2020.3.13
	*visualcube.php改为index.php, 静态文件目录加入前缀visualcube 
	* fc,sch,fd支持数字代表参数重复, 快速涂色, 如y20r6
	* alg,case支持重复符号和所有SiGN符号, 如(RUR'U')3, 2R, 2-5r, m
	
	V0.6.6 by Ruimin Yan 2020.4.3
  * config.php中将最大阶数改为52, 默认旋转序列改为r=y30x-30, 默认配色ygrwbo
  * 默认背景改为透明
  * 支持更多颜色zfiecva
  
  	V0.6.7 by Ruimin Yan 2020.5.15
  * More stages

  	V0.6.8 by Kira 2020.5.19
  * fix bug of alg&case: m

    V0.6.9 by Ruimin Yan 2020.5.25
  * Skip API page. Set default fmt=svg.
  
  
*/

	// Import configuration values
	require 'visualcube_config.php';

	global
		$DB_HOST,
		$DB_NAME,
		$DB_USERNAME,
		$DB_PASSWORD,
		$MAX_PZL_DIM,
		$ENABLE_COOKIES,
		$ENABLE_CACHE,
		$CACHE_IMG_SIZE_LIMIT,
		$DEFAULTS;


	// VisualCube version
	$VERSION = "0.6.8";


	// Causes cube svg to be outputted as XML for inspection
	$DEBUG = false;
	// Do not display errors
//	if (!$DEBUG) error_reporting(0);


	// ----------------------[ API Page ]-----------------------

	// If no format specified, display API page
	// skip API page -- Ruimin Yan 2020.5.25
	// if(!array_key_exists('fmt', $_REQUEST)){

	//	include 'visualcube_api.php';

	// Otherwise render a cube
	// }else{
		// Check cache for image and return if it exists in cache
		if($ENABLE_CACHE){
			// Connect to db
			$mysql_con = mysqli_connect($DB_HOST, $DB_USERNAME, $DB_PASSWORD, $DB_NAME) or die("Connect Error: " . mysqli_connect_error());

			$hash = md5($_SERVER['QUERY_STRING']);
			$imgdata = get_arrays($mysql_con, "SELECT fmt, req, rcount, img FROM vcache WHERE hash='$hash'");
			// Verify query strings are equal (deals with unlikely, but possible hash collisions)
			if($imgdata && count($imgdata) > 0 && $imgdata[0]['req'] == $_SERVER['QUERY_STRING']){
				display_img($imgdata[0]['img'], $imgdata[0]['fmt']);
				// Increment access count
				mysqli_query($mysql_con, "UPDATE vcache SET rcount=rcount+1 WHERE hash='$hash'");
				// Disconnect from db
				mysqli_close();
				return;
			}
		}


		// Otherwise generate image


		// -----------------[ Constants ]-----------------

		// Faces
		$U = 0; $R = 1; $F = 2; $D = 3; $L = 4; $B = 5; $N = 6; $O = 7; $T = 8;


		// Colour constants
		$BLACK  = '000000';
		$DGREY  = '404040';
		$GREY   = '808080';
		$SILVER = 'BFBFBF';
		$WHITE  = 'FFFFFF';
		$YELLOW = 'FEFE00';
		$RED    = 'EE0000';//'FE0000';
		$ORANGE = 'FFA100';//'FE8600';
		$BLUE   = '0000F2';
		$GREEN  = '00D800';//'00F300';
		$PURPLE = 'A83DD9';
		$PINK   = 'F33D7B';
		$ZERO   =	'1B1B1B';
		$CUSTOM =	'      '; // Define your color
		$FOREST =	'006600';
		$LPINK  =	'FF99FF';
		$CREAM  = 'EEE8AA';
		$CYAN   =	'88DDFF';
		$NAVY   =	'3375B2';
		$TAN    =	'885500';		

		// Other colour schemes
		// Array('FFFF00', 'FF0000', '0000FF', 'FFFFFF', 'FF7F00', '00FF00'); // Basic
		// Array('EFEF00', 'C80000', '0000B6', 'F7F7F7', 'FFA100', '00B648'); // Cubestation
		// Array('EFFF01', 'FF0000', '1600FF', 'FEFFFC', 'FF8000', '047F01'); // cube.rider
		// Array('FEFE00', 'FE0000', '0000F2', 'FEFEFE', 'FE8600', '00F300'); // alg.garron

		// Name colour mapping
		$NAME_COL = Array(
			'black'  => $BLACK,
			'dgrey'  => $DGREY,
			'grey'   => $GREY,
			'silver' => $SILVER,
			'white'  => $WHITE,
			'yellow' => $YELLOW,
			'red'    => $RED,
			'orange' => $ORANGE,
			'blue'   => $BLUE,
			'green'  => $GREEN,
			'purple' => $PURPLE,
			'pink'   => $PINK,
			'zero'   => $ZERO,
			'null'   => $CUSTOM,
			'forest' => $FOREST,
			'lpink'  => $LPINK,
			'cream'  => $CREAM,
			'cyan'   => $CYAN,
			'navy'   => $NAVY,
			'tan'    => $TAN);

		// Abbreviation colour mapping
		$ABBR_COL = Array(
			'n' => $BLACK,
			'd' => $DGREY,
			'l' => $GREY,
			's' => $SILVER,
			'w' => $WHITE,
			'y' => $YELLOW,
			'r' => $RED,
			'o' => $ORANGE,
			'b' => $BLUE,
			'g' => $GREEN,
			'm' => $PURPLE,
			'p' => $PINK,
			't' => 't',  // Transparent
			'z' => $ZERO,
			'u' => $CUSTOM,
			'f' => $FOREST,
			'i' => $LPINK,
			'e' => $CREAM,
			'c' => $CYAN,
			'v' => $NAVY,
			'a' => $TAN);

		// Default colour scheme
		$DEF_SCHEME = Array ($YELLOW, $RED, $BLUE, $WHITE, $ORANGE, $GREEN, $DGREY, $GREY, 't');
		// $DEF_SCHEME = Array ($WHITE, $RED, $GREEN, $BLUE, $ORANGE, $YELLOW, $GREY, $SILVER, 't'); // Japanese scheme

		// Corresponding mappings from colour code to face id
		$DEF_SCHCODE = Array('y', 'r', 'b', 'w', 'o', 'g',);
		//$DEF_SCHCODE = Array('w', 'r', 'g', 'b', 'o', 'y',); // Japanese scheme


		// -----------------------[ User Parameters ]--------------------

		// Set default fmt=svg. -- Ruimin Yan 2020.5.25
		// Retrieve format from user, default to first in list otherwise
		// $LEGAL_FMT = Array ('gif', 'png', 'svg', 'jpg', 'jpe', 'jpeg', 'tiff', 'ico');
		// $fmt = $LEGAL_FMT[0];
		// if(array_key_exists('fmt', $_REQUEST) || array_key_exists('fmt', $DEFAULTS)){
		//	$fmt = array_key_exists('fmt', $_REQUEST) ? $_REQUEST['fmt'] : $DEFAULTS['fmt'];
		//	if(!in_array($fmt, $LEGAL_FMT))
		//		$fmt = $LEGAL_FMT[0];
		//	else{
		//		if($fmt == 'jpeg' || $fmt == 'jpe') $fmt = 'jpg';
		//	}
		// }

    $fmt = 'svg';

		// Default rotation sequence
		$rtn = Array(Array(1, 45), Array(0, -34));
		// Get rotation from request (or cookie)
		if(array_key_exists('r', $_REQUEST) || array_key_exists('r', $DEFAULTS)
		|| ($ENABLE_COOKIES && isset($_COOKIE['vc_r']) && $_COOKIE['vc_r'] != '')){
			$_r = array_key_exists('r', $_REQUEST) ? $_REQUEST['r'] :
			($ENABLE_COOKIES && isset($_COOKIE['vc_r']) && $_COOKIE['vc_r'] != '' ?
				$_COOKIE['vc_r'] : $DEFAULTS['r']);
			preg_match_all('/([xyz])(\-?[0-9][0-9]?[0-9]?)/', $_r, $matches);
			for($i = 0; $i < count($matches[0]); $i++){
				switch($matches[1][$i]){
					case 'x' : $rtn_[$i][0] = 0; break;
					case 'y' : $rtn_[$i][0] = 1; break;
					case 'z' : $rtn_[$i][0] = 2; break;
					default : break;
				}
				$rtn_[$i][1] = $matches[2][$i];
			}
			if($rtn_) $rtn = $rtn_;
		}

		// Retrieve cube Dimension
		$dim = $DEFAULTS['pzl'];
		if(array_key_exists('pzl', $_REQUEST) && is_numeric($_REQUEST['pzl'])
		&& $_REQUEST['pzl'] > 0 && $_REQUEST['pzl'] <= $MAX_PZL_DIM)
			$dim = $_REQUEST['pzl'];

		// Default scheme
		$scheme = $DEF_SCHEME;
		// Default mapping from colour code to face id
		$schcode = $DEF_SCHCODE;
		// Retrieve colour scheme from request (or cookie)
		if(array_key_exists('sch', $_REQUEST) || array_key_exists('sch', $DEFAULTS)
		|| ($ENABLE_COOKIES && isset($_COOKIE['vc_sch']) && $_COOKIE['vc_sch'] != '')){
			// Retrieve from cookie or 'sch' variable
			$sd = array_key_exists('sch', $_REQUEST) ? $_REQUEST['sch'] :
			($ENABLE_COOKIES && isset($_COOKIE['vc_sch']) && $_COOKIE['vc_sch'] != '' ?
				$_COOKIE['vc_sch'] : $DEFAULTS['sch']);
			
			if(preg_match_all('/([ndlswyrobgmpzufiecvat])([2-6])/', $sd, $matches)){


				$sd = preg_replace_callback('/([ndlswyrobgmpzufiecvat])([1-9][0-9]*)/',function($matches){
					$subalgs = $matches[1];
					$repeattimers = $matches[2];
					$new = '';
					for($i =0;$i<$repeattimers;$i++){
						$new =  $new.$subalgs;
					}
					return $new;
				},$sd);

			}

			if(preg_match('/^[ndlswyrobgmpzufiecvat]{6}$/', $sd)){
				for($i = 0; $i < 6; $i++){
					$scheme[$i] = $ABBR_COL[$sd[$i]];
					$schcode[$i] = $sd[$i];
				}
			} 
			else{
				$cols = preg_split('/,/', $sd);
				if(count($cols) == 6){
					$cok = true;
					for($i = 0; $i < 6; $i++){
						$scheme[$i] = parse_col($cols[$i]);
						if(!$cols[$i]) $cok = false;
					}
					if(!$cok) $scheme = $DEF_SCHEME;
				}
			}
		}

		// Retrieve size from user
		$size = $DEFAULTS['size']; // default
		if(array_key_exists('size', $_REQUEST) && is_numeric($_REQUEST['size'])){
			$size = $_REQUEST['size'];
			if($size < 0) $size = 0;
			if($size > 1024) $size = 1024;
		}

		// Retrieve dist variable - projection distance (how close the eye is to the cube)
		$dist = $DEFAULTS['dist']; // default dist parameter
		if(array_key_exists('dist', $_REQUEST) || ($ENABLE_COOKIES && isset($_COOKIE['vc_dist']))){
			$dist_ = array_key_exists('dist', $_REQUEST) ? $_REQUEST['dist'] : $_COOKIE['vc_dist'];
			if(is_numeric($dist_)) $dist = $dist_ < 1 ? 1 : ($dist_ > 100 ? 100 : $dist_);
		}

		// Retrieve view variable
		$view = $DEFAULTS['view'];
		if(array_key_exists('view', $_REQUEST)){
			$view = $_REQUEST['view'];
		}

		// Retrieve background colour from request (or cookies)
		$bg = parse_col($DEFAULTS['bg']);
		if(!$bg) $bg = null; // by Ruimin Yan 2020.4.3
		if(array_key_exists('bg', $_REQUEST) || ($ENABLE_COOKIES && isset($_COOKIE['vc_bg']))){
			$bg_ = array_key_exists('bg', $_REQUEST) ? $_REQUEST['bg'] : $_COOKIE['vc_bg'];
			if($bg_ == "t") $bg = null;
			else{
				$bg_ = parse_col($bg_);
				if($bg_) $bg = $bg_;
			}
		}

		// Retrieve cube colour from request (or cookies)
		$cc = $view == 'trans' ? $SILVER : parse_col($DEFAULTS['cc']);
		if(array_key_exists('cc', $_REQUEST) || ($ENABLE_COOKIES && isset($_COOKIE['vc_cc']))){
			$cc_ = array_key_exists('cc', $_REQUEST) ? $_REQUEST['cc'] : $_COOKIE['vc_cc'];
			$cc_ = parse_col($cc_);
			if($cc_) $cc = $cc_;
		}
		$cc = !$cc ? $BLACK : $cc;

		// Retrieve cube opacity from request (or cookies)
		$co = $view == 'trans' ? 50 : $DEFAULTS['co'];
		if(array_key_exists('co', $_REQUEST) || ($ENABLE_COOKIES && isset($_COOKIE['vc_co']))){
			$co_ = array_key_exists('co', $_REQUEST) ? $_REQUEST['co'] : $_COOKIE['vc_co'];
			if(preg_match('/^[0-9][0-9]?$/', $co_)) $co = $co_;
		}
		$co = !is_numeric($co) || $co < 0 || $co > 100 ? 100 : $co;

		// Retrieve face opacity from request (or cookies)
		$fo = $DEFAULTS['fo'];
		if(!is_numeric($fo) || $fo < 0 || $fo > 100)
			$fo = 100;
		if(array_key_exists('fo', $_REQUEST) || ($ENABLE_COOKIES && isset($_COOKIE['vc_fo']))){
			$fo_ = array_key_exists('fo', $_REQUEST) ? $_REQUEST['fo'] : $_COOKIE['vc_fo'];
			if(preg_match('/^[0-9][0-9]?$/', $fo_)) $fo = $fo_;
		}


		// Create default face defs
		for($fc = 0; $fc < 6; $fc++){ for($i = 0; $i < $dim * $dim; $i++)
			$facelets[$fc * $dim * $dim + $i] = $fc;
		}
		// Retrieve colour def
		// This overrides face def and makes the $scheme variable redundant (ie, gets reset to default)
		$using_cols = false;
		$uf = array_key_exists('fc', $_REQUEST) ? $_REQUEST['fc'] : (!array_key_exists('fd', $_REQUEST) ? $DEFAULTS['fc'] : '');
		
		if(preg_match_all('/([ndlswyrobgmpzufiecvat])([1-9][0-9]*)/', $uf, $matches)){

			$uf = preg_replace_callback('/([ndlswyrobgmpzufiecvat])([1-9][0-9]*)/',function($matches){
				$subalgs = $matches[1];
				$repeattimers = $matches[2];
				$new = '';
				for($i =0;$i<$repeattimers;$i++){
					$new =  $new.$subalgs;
				}
				return $new;
			},$uf);
		}
		
		if(preg_match('/^[ndlswyrobgmpzufiecvat]+$/', $uf)){
			$using_cols = true;
			$scheme = $DEF_SCHEME;
			$nf = strlen($uf);
			for($fc = 0; $fc < 6; $fc++)
				{ for($i = 0; $i < $dim * $dim; $i++){
					// Add user defined face
					if($fc * $dim *$dim + $i < $nf)
						$facelets[$fc * $dim * $dim + $i] = $uf[$fc * $dim *$dim + $i];
					// Otherwise use scheme code
					else
						$facelets[$fc * $dim * $dim + $i] = $schcode[$fc];
				}
			}
		}
		// Retrieve facelet def
		if(!$uf){ $uf = array_key_exists('fd', $_REQUEST) ? $_REQUEST['fd'] : $DEFAULTS['fd'];

			if(preg_match_all('/([ndlswyrobgmpzufiecva])([1-9][0-9]*)/', $uf, $matches)){


				$uf = preg_replace_callback('/([ndlswyrobgmpzufiecvat])([1-9][0-9]*)/',function($matches){
					$subalgs = $matches[1];
					$repeattimers = $matches[2];
					$new = '';
					for($i =0;$i<$repeattimers;$i++){
						$new =  $new.$subalgs;
					}
					return $new;
				},$uf);
			}
		
		if(preg_match('/^[udlrfbnot]+$/', $uf)){
			// Map from face names to numeric face ID
			$fd_map = Array('u' => $U, 'r' => $R, 'f' => $F, 'd' => $D, 'l' => $L, 'b' => $B, 'n' => $N, 'o' => $O, 't' => $T);
			$nf = strlen($uf);
			for($fc = 0; $fc < 6; $fc++){ for($i = 0; $i < $dim * $dim; $i++){
				// Add user defined face
				if($fc * $dim *$dim + $i < $nf)
					$facelets[$fc * $dim * $dim + $i] = $fd_map[$uf[$fc * $dim *$dim + $i]];
				// Otherwise default to a blank/transparent face
				else $facelets[$fc * $dim *$dim + $i] = $view == 'trans' ? $T : $N;
			}}
		}}
		// Retrieve stage variable
		if(array_key_exists('stage', $_REQUEST) || array_key_exists('stage', $DEFAULTS)){
			$stage = array_key_exists('stage', $_REQUEST) ? $_REQUEST['stage'] : $DEFAULTS['stage'];
			// Extract rotation sequence if present
			$p = strrpos($stage, '-');
			$st_rtn = '';
			if($p > 0){
				$st_rtn = urldecode(substr($stage, $p+1));
				$stage = substr($stage, 0, $p);
			}
			// Stage Definitions
			$mask = $stage;
			if($dim == 3){
				switch($stage){
					case 'fl' :
				$mask = "000000000000000111000000111111111111000000111000000111";
				break;
					case 'f2l' :
				$mask = "000000000000111111000111111111111111000111111000111111";
				break;
					case 'll' :
				$mask = "111111111111000000111000000000000000111000000111000000";
				break;
					case 'cll' :
				$mask = "101010101101000000101000000000000000101000000101000000";
				break;
					case 'ell' :
				$mask = "010111010010000000010000000000000000010000000010000000";
				break;
					case 'oll' :
				$mask = "111111111000000000000000000000000000000000000000000000";
				break;
					case 'ocll' :
				$mask = "101010101000000000000000000000000000000000000000000000";
				break;
					case 'oell' :
				$mask = "010111010000000000000000000000000000000000000000000000";
				break;
					case 'coll' :
				$mask = "111111111101000000101000000000000000101000000101000000";
				break;
					case 'ocell' :
				$mask = "111111111010000000010000000000000000010000000010000000";
				break;
					case 'wv' :
				$mask = "111111111000111111000111111111111111000111111000111111";
				break;
					case 'vh' :
				$mask = "010111010000111111000111111111111111000111111000111111";
				break;
					case 'els' :
				$mask = "010111010000111011000111110110111111000111111000111111";
				break;
					case 'cls' :
				$mask = "111111111000111111000111111111111111000111111000111111";
				break;
					case 'cmll' :
				$mask = "101000101101111111101101101101101101101111111101101101";
				break;
					case 'cross' :
				$mask = "000000000000010010000010010010111010000010010000010010";
				break;
					case 'f2l_3' :
				$mask = "000000000000110110000011011011111010000010010000010010";
				break;
					case 'f2l_2' :
				$mask = "000000000000011011000010010010111111000110110000111111";
				break;
					case 'f2l_sm' :
				$mask = "000000000000110110000011011011111110000110110000011011";
				break;
					case 'f2l_1' :
				$mask = "000000000000011011000110110110111111000111111000111111";
				break;
					case 'f2b' :
				$mask = "000000000000111111000101101101101101000111111000101101";
				break;
					case 'line' :
				$mask = "000000000000000000000010010010010010000000000000010010";
				break;
					case '2x2x2' :
				$mask = "000000000000110110000011011011011000000000000000000000";
				break;
					case '2x2x3' :
				$mask = "000000000000110110000111111111111000000011011000000000";
				break;
				  case 'fb1' :
				$mask = "000000000000000000000100100100100000000011011000000000";
				break;
				 case 'fb2' :
				$mask = "000000000000000000000000000000100100000110110000001001";
				break;
				case 'sb1' :
				$mask = "000000000000110110000001001001001000000000000000000000";
				break;
				case 'sb2' :
				$mask = "000000000000011011000000000000001001000000000000100100";
				break;
				case 'fb' :
				$mask = "000000000000000000000100100100100100000111111000001001";
				break;
				case 'sb' :
				$mask = "000000000000111111000001001001001001000000000000100100";
				break;
				  // by Ruimin Yan 2020.3.9
					case 'FL' :
				$mask = "000000000000000111000000111111111111000000111000000111";
				break;
					case 'F2L' :
				$mask = "000000000000111111000111111111111111000111111000111111";
				break;
					case '1LLL' :
				$mask = "111111111111000000111000000000000000111000000111000000";
				break;
					case 'OLL' :
				$mask = "111111111000000000000000000000000000000000000000000000";
				break;
					case 'OLLCP' :
				$mask = "111111111101000000101000000000000000101000000101000000";
				break;
					case 'OLS' :
				$mask = "111111111000111111000111111111111111000111111000111111";
				break;
					case 'EOLRb_R' :
				$mask = "010101010111000000000000000010000010010000000000000000";
				break;
					case 'EOLRb_L' :
				$mask = "010101010010000000000000000010000010111000000000000000";
				break;
					case 'EOLRb_F' :
				$mask = "010101010010000000101000000010000010010000000000000000";
				break;
					case 'EOLRb_B' :
				$mask = "010101010010000000000000000010000010010000000101000000";
				break;
					case 'EOLS' :
				$mask = "010111010000111111000111111111111111000111111000111111";
				break;
					case 'ELS' :
				$mask = "010111010000111011000111110110111111000111111000111111";
				break;
				  case 'L5EF' :
				$mask = "010111010010111011010111110110111111010111111010111111";
				break;
				  case 'CLL' :
				$mask = "101000101101111111101111111111111111101111111101111111";
				break;
					case 'CMLL' :
				$mask = "101000101101111111101101101101101101101111111101101101";
				break;
					case 'Roux_CO' :
				$mask = "101000101000000000000000000000000000000000000000000000";
				break;
					case 'Roux_DR' :
				$mask = "000000000000000010000100100100101100000111111000001001";
				break;
					case 'Roux_DRonly' :
				$mask = "000000000000000010000000000000001000000000000000000000";
				break;
					case 'Cross' :
				$mask = "000000000000000010000000010010111010000000010000000010";
				break;		
					case 'Cross_Center' :
				$mask = "000000000000010010000010010010111010000010010000010010";
				break;
				case 'Cross_FR' :
				$mask = "000000000000000010000000010010011000000000000000000000";
				break;
				case 'Cross_BR' :
				$mask = "000000000000000010000000000000011010000000000000000010";
				break;
					case 'Cross_FB' :
				$mask = "000000000000000000000000010010010010000000000000000010";
				break;
					case 'Cross_LR' :
				$mask = "000000000000000010000000000000111000000000010000000000";
				break;
					case 'Xcross_FR' :
				$mask = "000000000000110110000011011011111010000010010000010010";
				break;
					case 'Xcross_BR' :
				$mask = "000000000000011011000010010010111011000010010000110110";
				break;
					case 'Xcross_FL' :
				$mask = "000000000000010010000110110110111010000011011000010010";
				break;
					case 'Xcross_BL' :
				$mask = "000000000000010010000010010010111110000110110000011011";
				break;
					case 'XXcross' :
				$mask = "000000000000011011000010010010111111000110110000111111";
				break;
					case 'DEC' :
				$mask = "000000000000110110000011011011111110000110110000011011";
				break;
					case 'TEC_FR' :
				$mask = "000000000000011011000110110110111111000111111000111111";
				break;
					case 'TEC_FL' :
				$mask = "000000000000111111000011011011111111000110110000111111";
				break;
					case 'TEC_BL' :
				$mask = "000000000000111111000111111111111011000011011000110110";
				break;
					case 'TEC_BR' :
				$mask = "000000000000110110000111111111111110000111111000011011";
				break;
          case 'EO_Orbit' :
				$mask = "010101010000000000000101000010101010000000000000101000";
				break;
          case 'EO_Outer_Orbit' :
				$mask = "000000000010101010010000010000000000010101010010000010";
				break;
				  case '112' :
				$mask = "000000000000000000000100100100000000000001001000000000";
				break;
				  case '122' :
				$mask = "000000000000100100000011011011000000000000000000000000";
				break;
					case '222' :
				$mask = "000000000000110110000011011011011000000000000000000000";
				break;
				  case '222_FL' :
				$mask = "000000000000000000000110110110110000000011011000000000";
				break;
				  case '222_BL' :
				$mask = "000000000000000000000000000000110110000110110000011011";
				break;
				  case '222_BR' :
				$mask = "000000000000011011000000000000011011000000000000110110";
				break;
					case '223' :
				$mask = "000000000000110110000111111111111000000011011000000000";
				break; 
					case 'F2B' :
				$mask = "000000000000111111000101101101101101000111111000101101";
				break; 
				  case 'FB1' :
				$mask = "000000000000000000000100100100100000000011011000000000";
				break;
				  case 'FB2' :
				$mask = "000000000000000000000000000000100100000110110000001001";
				break;
				  case 'SB1' :
				$mask = "000000000000110110000001001001001000000000000000000000";
				break;
				  case 'SB2' :
				$mask = "000000000000011011000000000000001001000000000000100100";
				break;
				  case 'FB' :
				$mask = "000000000000000000000100100100100100000111111000001001";
				break;
				  case 'SB' :
				$mask = "000000000000111111000001001001001001000000000000100100";
				break;
				  case 'SQ_RDF' :
				$mask = "000000000000110110000011001001011000000000000000000000";
				break;
				  case 'SQ_FDR' :
				$mask = "000000000000110100000011011011010000000000000000000000";
				break;
				  case 'SQ_DFR' :
				$mask = "000000000000010110000010011011011000000000000000000000";
				break;
					case 'Line' :
				$mask = "000000000000000000000010010010010010000000000000010010";
				break;
					case 'DR' :
				$mask = "111101111000000000000101000111101111000000000000101000";
				break;
					case 'DR_R' :
				$mask = "001001001000000000000001000001001001000000000000100000";
				break;
					case 'DR_R_U2_Rp' :
				$mask = "100100101000000000000001000001000000000000000000000000";
				break;
					case 'DR_R_U_Rp' :
				$mask = "000000111000000000000001000001000000000000000000000000";
				break;
					case 'DR_R_Up_Rp' :
				$mask = "110000001000000000000001000001000000000000000000000000";
				break;
					case 'DR_U' :
				$mask = "000000000111000000010000000000000000111000000010000000";
				break;
					case 'Pair' :
				$mask = "000000000000110110000011011011111010000010010000010010";
				break;
					case 'Mehta_Sq' :
				$mask = "000000000000000110000000011011011000000000000000000000";
				break;
					case 'Mehta_Belt2' :
				$mask = "000000000000111000000111110110110110000111111000111011";
				break;
					case 'Mehta_EOLE2' :
				$mask = "010111010000111000000111110110111110000111111000111011";
				break;
				case 'Mehta_TDR' :
				$mask = "000000000000000111000000001001001001000000000000000100";
				break;
				}
			}else if($dim == 2){
				switch($stage){
					case 'fl' :
				$mask = "000000110011111100110011";
				break;
					case 'll' :
				$mask = "111111001100000011001100";
				break;
					case 'oll' :
				$mask = "111100000000111100000000";
				break;
				// Ruimin Yan 2020.3.10
					case 'FF' :
				$mask = "000000000000111100000000";
				break;
					case 'FL' :
				$mask = "000000110011111100110011";
				break;
					case '1LLL' :
				$mask = "111111001100000011001100";
				break;
					case 'OLL' :
				$mask = "111100000000111100000000";
				break;  
				}
			}else if($dim == 4){
				switch($stage){
						case 'F1C' :
				$mask = "000000000000000000000000000000000000000000000000000001100110000000000000000000000000000000000000";
				break;
						case 'F2C' :
				$mask = "000001100110000000000000000000000000000000000000000001100110000000000000000000000000000000000000";
				break;
					case 'L2C' :
				$mask = "000001100110000000000000000000000000011001100000000000000000000000000000000000000000000000000000";
				break;
					case 'Center' :
				$mask = "000001100110000000000110011000000000011001100000000001100110000000000110011000000000011001100000";
				break;
					case 'F1E' :
				$mask = "000010001000000000000110011000000000000000000000000000000000000001100110011000000000000000000000";
				break;
					case 'LCE' :
				$mask = "000011101110000000000110011000000000111011100000000011101110000001101111111101100000011101110000";
				break;
					case 'No_Corner' :
				$mask = "011011111111011001101111111101100110111111110110011011111111011001101111111101100110111111110110";
				break; 
					case 'Hoya' :
				$mask = "000000000000000000000110011001100000000000000110011011111111011000000110011001100000011001100110";
				break;
					case 'Yau' :
				$mask = "000001100110000000000110011001100000011001100000000011111111011000000110011001100000011001100110";
				break;
					case 'Meyer' :
				$mask = "000000000000000000000110011000000000100010001000100010001000100000001111111111110000000100010001";
				break;
					case 'Half_Center' :
				$mask = "000000000000000000000110011000000000010001000000000001000100000000000110011000000000001000100000";
				break;
					case 'OLL' :
				$mask = "111111111111111100000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
				}
			}else if($dim == 5){
				switch($stage){
					case '1x3' :
				$mask = "000000001000010000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
					case '2x3' :
				$mask = "000000011000110001100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
				  case '3x3' :
				$mask = "000000111001110011100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
					case '2x2' :
				$mask = "000000000000110001100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
					case 'T' :
				$mask = "000000001001110000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
					case 'L2C' :
				$mask = "000000111001110011100000000000000000000000000000000000001110011100111000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
				  case 'L2E' :
				$mask = "000000000000000000000111000000000010000100001000000111000000000000000000000000000000000000000000000000000000000000000000000000000010000100001000000000";
				break;
					case 'L1E' :
				$mask = "000000000000000000000111000000000000000000000000000111000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
					case 'Center' :
				$mask = "000000111001110011100000000000011100111001110000000000001110011100111000000000000111001110011100000000000011100111001110000000000001110011100111000000";
				break; 
				  case 'Midge' :
				$mask = "001000000010001000000010000100000001000100000001000010000000100010000000100001000000010001000000010000100000001000100000001000010000000100010000000100";
				break;
				  case 'T_Center' :
				$mask = "000000010001010001000000000000001000101000100000000000000100010100010000000000000010001010001000000000000001000101000100000000000000100010100010000000";
				break;
				  case 'X_Center' :
				$mask = "000000101000000010100000000000010100000001010000000000001010000000101000000000000101000000010100000000000010100000001010000000000001010000000101000000";
				break;
				  case 'Wing' :
				$mask = "010101000100000100010101001010100010000010001010100101010001000001000101010010101000100000100010101001010100010000010001010100101010001000001000101010";
				break;
				  case 'OLL' :
				$mask = "111111111111111111111111100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
				}
			}else if($dim == 6){
				switch($stage){
					case '1x4' :
				$mask = "000000000010000010000010000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
					case '2x4' :
				$mask = "000000000110000110000110000110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
					case '3x4' :
				$mask = "000000001110001110001110001110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
					case '4x4' :
				$mask = "000000011110011110011110011110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
					case '2x2' :
				$mask = "000000000000000000000110000110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
					case '3x3' :
				$mask = "000000000000001110001110001110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
					case 'T' :
				$mask = "000000000010011110011110000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
					case '3_1x4' :
				$mask = "000000010110010110010110010110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
				  case 'L2C' :
				$mask = "000000011110011110011110011110000000000000000000000000000000000000000000000000011110011110011110011110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
				  case 'L2E' :
				$mask = "000000000000000000000000000000011110000000000001000001000001000001000000011110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000100000100000100000000000";
				break;
					case 'L1E' :
				$mask = "000000000000000000000000000000011110000000000000000000000000000000000000011110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
					case 'Oblique' :
				$mask = "000000001100010010010010001100000000000000001100010010010010001100000000000000001100010010010010001100000000000000001100010010010010001100000000000000001100010010010010001100000000000000001100010010010010001100000000";
				break;
					case 'Center' :
				$mask = "000000011110011110011110011110000000000000011110011110011110011110000000000000011110011110011110011110000000000000011110011110011110011110000000000000011110011110011110011110000000000000011110011110011110011110000000";
				break;
					case 'OLL' :
				$mask = "111111111111111111111111111111111111000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break; 
				}
			}else if($dim == 7){
				switch($stage){
					case '1x5' :
				$mask = "000000000000100000010000001000000100000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
					case '2x5' :
				$mask = "000000000001100000110000011000001100000110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
					case '3x5' :
				$mask = "000000000011100001110000111000011100001110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
					case '4x5' :
				$mask = "000000000111100011110001111000111100011110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
					case '5x5' :
				$mask = "000000001111100111110011111001111100111110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
					case '2x2' :
				$mask = "000000000000000000000000000000001100000110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
					case '3x3' :
				$mask = "000000000000000000000000111000011100001110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break; 
					case '4x4' :
				$mask = "000000000000000011110001111000111100011110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break; 
					case 'L2C' :
				$mask = "000000001111100111110011111001111100111110000000000000000000000000000000000000000000000000000000000000000011111001111100111110011111001111100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
					case 'L2E' :
				$mask = "000000000000000000000000000000000000000000011111000000000000001000000100000010000001000000100000000111110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000010000001000000100000010000000000000";
				break; 
					 case 'L1E' :
				$mask = "000000000000000000000000000000000000000000011111000000000000000000000000000000000000000000000000000111110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
					case 'Center' :
				$mask = "000000001111100111110011111001111100111110000000000000000111110011111001111100111110011111000000000000000011111001111100111110011111001111100000000000000001111100111110011111001111100111110000000000000000111110011111001111100111110011111000000000000000011111001111100111110011111001111100000000";
				break;
					case 'OLL' :
				$mask = "111111111111111111111111111111111111111111111111100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
				break;  
				}
			}else if($dim == 8){
				switch($stage){
						case '' :
				$mask = "";
				break;
						case '' :
				$mask = "";
				break;
					case '' :
				$mask = "";
				break;
				}
			}else if($dim == 9){
				switch($stage){
						case 'UF' :
				$mask = "000000000000000000000000000000000000000000000000000000000000000000000000011111110000000000000000000000000000000000000000000000000000000000000000000000000000000000011111110";
				break;
						case 'DF' :
				$mask = "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011111110011111110";
				break;
					case 'UB' :
				$mask = "011111110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011111110000000000000000000000000000000000000000000000000000000000000000000000000";
				break;
				}
			}else if($dim == 10){
				switch($stage){
						case '' :
				$mask = "";
				break;
						case '' :
				$mask = "";
				break;
					case '' :
				$mask = "";
				break;
				}
			
	
	
	
	
			
			}
					
			
		
			// Apply alg to mask if defined
			if($mask && $st_rtn != ''){
				require_once "cube_lib.php";
				$mask = fcs_doperm($mask, fcs_format_alg($st_rtn), $dim);
			}

			// Apply mask to face def
			if($mask){
				for($i = 0; $i < $dim * $dim * 6; $i++){
					$facelets[$i] = $mask[$i] == 0 ?
						($view == 'trans' ? ($using_cols ? 't' : $T) :
						($using_cols ? 'l' : $N)) : $facelets[$i];
				}
			}
		}

		// Retrieve alg def
		if(array_key_exists('alg', $_REQUEST) || array_key_exists('case', $_REQUEST)
		|| array_key_exists('alg', $DEFAULTS) || array_key_exists('case', $DEFAULTS)){
			require_once "cube_lib.php";
			if(array_key_exists('alg', $_REQUEST)) $alg = $_REQUEST['alg']; else $alg = $DEFAULTS['alg'];
			if(array_key_exists('case', $_REQUEST)) $case = $_REQUEST['case']; else $case = $DEFAULTS['case'];
		  $alg = fcs_format_alg(urldecode($alg));
		  $case = invert_alg(fcs_format_alg(urldecode($case)));
//			$facelets = facelet_cube(case_cube($alg), $dim, $facelets); // old 3x3 alg system
			$facelets = fcs_doperm($facelets, $case . ' ' . $alg, $dim); // new NxN facelet permute
		}

		// Retrieve arrow defn's
		if(array_key_exists('arw', $_REQUEST)){
			$astr = preg_split('/,/', $_REQUEST['arw']);
			$i = 0;
			foreach($astr as $a){
				$a_ = parse_arrow($a, $dim);
				if($a_) $arrows[$i++] = $a_;
			}
		}

		// Retrieve default arrow colour
		$ac = $GREY;
		if(array_key_exists('ac', $_REQUEST)){
			$ac_ = parse_col($_REQUEST['ac']);
			if($ac_ && $ac_ != 't') $ac = $ac_;
		}

		// ---------------[ 3D Cube Generator properties ]---------------

		// Outline width
		$OUTLINE_WIDTH = 0.94;

		// Stroke width
		$sw = 0;

		// Viewport
		$ox = -0.9;
		$oy = -0.9;
		$vw = 1.8;
		$vh = 1.8;

		// ------------------[ 3D Cube Generator ]-----------------------

		// Set up cube for OLL view if specified
		if($view == 'plan'){
			$rtn = Array(Array(0, -90));
		}

		// All cube face points
		$p = Array();
		// Translation vector to centre the cube
		$t = Array(-$dim/2, -$dim/2, -$dim/2);
		// Translation vector to move the cube away from viewer
		$zpos = Array(0, 0, $dist);


		// Rotation vectors to track visibility of each face
		$rv = Array(Array(0, -1, 0), Array(1, 0, 0), Array(0, 0, -1), Array(0, 1, 0), Array(-1, 0, 0), Array(0, 0, 1));
		for($fc = 0; $fc < 6; $fc++){
			for($i = 0; $i <= $dim; $i++){
				for($j = 0; $j <= $dim; $j++){
					switch($fc){
						case $U : $p[$fc][$i][$j] = Array(       $i,    0, $dim - $j); break;
						case $R : $p[$fc][$i][$j] = Array(     $dim,   $j,        $i); break;
						case $F : $p[$fc][$i][$j] = Array(       $i,   $j,         0); break;
						case $D : $p[$fc][$i][$j] = Array(       $i, $dim,        $j); break;
						case $L : $p[$fc][$i][$j] = Array(        0,   $j, $dim - $i); break;
						case $B : $p[$fc][$i][$j] = Array($dim - $i,   $j,      $dim); break;
					}
					// Now scale and tranform point to ensure size/pos independent of dim
					$p[$fc][$i][$j] = translate($p[$fc][$i][$j], $t);
					$p[$fc][$i][$j] = scale($p[$fc][$i][$j], 1 / $dim);
					// Rotate cube as per perameter settings
					foreach($rtn as $rn){
						$p[$fc][$i][$j] = rotate($p[$fc][$i][$j], $rn[0], M_PI * $rn[1]/180);
					}
					// Move cube away from viewer
					$p[$fc][$i][$j] = translate($p[$fc][$i][$j], $zpos);
					// Finally project the 3D points onto 2D
					$p[$fc][$i][$j] = project($p[$fc][$i][$j], $zpos[2]);
				}
			}
			// Rotate rotation vectors
			foreach($rtn as $rn){
				$rv[$fc] = rotate($rv[$fc], $rn[0], M_PI * $rn[1]/180);
			}
		}

		// Sort render order (crappy bubble sort)
		$ro = Array(0, 1, 2, 3, 4, 5);
		for($i = 0; $i < 5; $i++){ for($j = 0; $j < 5; $j++){
			if($rv[$ro[$j]][2] < $rv[$ro[$j+1]][2]){
				$t = $ro[$j]; 
				$ro[$j] = $ro[$j+1]; 
				$ro[$j+1] = $t; 
			}
		}}

		// Cube diagram SVG XML
		$cube = "<?xml version='1.0' standalone='no'?>
<!DOCTYPE svg PUBLIC '-//W3C//DTD SVG 1.1//EN'
'http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd'>

<svg version='1.1' xmlns='http://www.w3.org/2000/svg'
	width='$size' height='$size'
	viewBox='$ox $oy $vw $vh'>\n";

	// Draw background
	if($bg) $cube .= "\t<rect fill='#$bg' x='$ox' y='$oy' width='$vw' height='$vh'/>\n";
		// modified by kira 2020.3.10
		// fix bug when set view as transparent
		// bug description: view=trans bottom layer's cross can't display, hidden by the stroke layer
		// fix by adding an if-else condition
		// modified by Ruimin Yan 2020.3.10
		// switch order of outline for each background face and polygon for each background facelet (transparency only)
		if($view == 'trans'){
				// Transparancy background rendering
				// Create outline for each background face (transparency only)
			$cube .= "\t<g style='stroke-width:0.1;stroke-linejoin:round;opacity:".($co/100)."'>\n";
			for($ri = 0; $ri < 3; $ri++)
				$cube .= outline_svg($ro[$ri]);
				$cube .= "\t</g>\n";
			
				// Create polygon for each background facelet (transparency only)
			$cube .= "\t<g style='opacity:".($fo/100).";stroke-opacity:0.5;stroke-width:$sw;stroke-linejoin:round'>\n";
				$cube .= facelet_svg($ro[0]); // Back Layer
				$cube .= facelet_svg($ro[1]); // Down Layer
				$cube .= facelet_svg($ro[2]); // Left Layer
	
			$cube .= "\t</g>\n";
		}
			// Create outline for each visible face
			$cube .= "\t<g style='stroke-width:0.1;stroke-linejoin:round;opacity:".($co/100)."'>\n";
			for($ri = 3; $ri < 6; $ri++){
				if(face_visible($ro[$ri], $rv) || $co < 100)
					$cube .= outline_svg($ro[$ri]);
			}
			$cube .= "\t</g>\n";

			// Create polygon for each visible facelet
			$cube .= "\t<g style='opacity:".($fo/100).";stroke-opacity:0.5;stroke-width:$sw;stroke-linejoin:round'>\n";
			for($ri = 3; $ri < 6; $ri++){
				if(face_visible($ro[$ri], $rv) || $co < 100)
					$cube .= facelet_svg($ro[$ri]);
			}
			$cube .= "\t</g>\n";
		

		// Create OLL view guides
		if($view == 'plan'){
			$cube .= "\t<g style='opacity:".($fo/100).";stroke-opacity:1;stroke-width:0.02;stroke-linejoin:round'>\n";
			$toRender = Array($F, $L, $B, $R);
			foreach($toRender as $fc)
				$cube .= oll_svg($fc);
			$cube .= "\t</g>\n";
		}

		// Draw Arrows
		if(isset($arrows)){
			$awidth = 0.12 / $dim;
			$cube .= "\t<g style='opacity:1;stroke-opacity:1;stroke-width:$awidth;stroke-linecap:round'>\n";
			foreach($arrows as $i => $a){
				$cube .= gen_arrow($i, $a[0], $a[1], $a[2], $a[4], array_key_exists(3, $a)?$a[3]:$ac);
			}
			$cube .= "\t</g>\n";
		}

		$cube .= "</svg>\n";





		// Display cube
		if($DEBUG) echo $cube;
		else{
			$img = $fmt != 'svg' ? convert($cube, $fmt, $size) : $cube;
			// echo 'nihao'
			display_img($img, $fmt);

			// Cache image if enabled
			if($ENABLE_CACHE && !array_key_exists("nocache", $_REQUEST) && strlen($img) < $CACHE_IMG_SIZE_LIMIT){
				$req = mysqli_real_escape_string($mysql_con, $_SERVER['QUERY_STRING']);
				$rfr = mysqli_real_escape_string($mysql_con, $_SERVER['HTTP_REFERER']);
				$hash = md5($req);
				$img = mysqli_real_escape_string($mysql_con, $img);
				mysqli_query($mysql_con, "INSERT INTO vcache(hash, fmt, req, rfr, rcount, img) ".
						"VALUES ('$hash', '$fmt', '$req', '$rfr', 1, '$img')");
				// Disconnect from db
				mysqli_close();
			}
		}
	// } -- Ruimin Yan 2020.5.25


	// -----------------[ User input functions ]----------------------

	// Parse colour value
	function parse_col($col){
		global $NAME_COL, $ABBR_COL;
		// As an abbriviation
		if(preg_match('/^[ndlswyrobgmpzufiecvat]$/', $col))
			return $ABBR_COL[$col];
		// As a name
		if(array_key_exists($col, $NAME_COL))
			return $NAME_COL[$col];
		// As 12-bit colour
		if(preg_match('/^[0-9a-fA-F]{3}$/', $col))
			return $col[0].$col[0].$col[1].$col[1].$col[2].$col[2];
		// As 24-bit colour
		if(preg_match('/^[0-9a-fA-F]{6}$/', $col))
			return $col;
		// Otherwise fail
		return null;
	}

	// Parse arrow definition
	function parse_arrow($str, $dim){
		$parts = preg_split('/-/', $str);
		$fcodes = array('U' => 0, 'R' => 1, 'F' => 2, 'D' => 3, 'L' => 4, 'B' => 5);
		if(count($parts) == 0) return null;
		if(!preg_match_all('/([URFDLB])([0-9]+)/', $parts[0], $split) || count($split) < 2) return null;
		$arrow = array();
		$arrow[4] = 1;
		for($i = 0; $i < 3; $i++){
			if($i == 2 && count($split[1]) < 3){
				$arrow[2] = null;
				break;
			}
			else	$arrow[2][3] = 2;
			$arrow[$i][0] = $fcodes[$split[1][$i]];
			$fn = $split[2][$i]; $fn = $fn >= $dim * $dim ? $dim * $dim - 1 : $fn;
			$arrow[$i][1] = $fn % $dim;
			$arrow[$i][2] = floor($fn / $dim);
		}
		// Parse remainder
		for($i = 1; $i < count($parts); $i++){
			if(preg_match('/^i[0-9]+$/', $parts[$i]) && $arrow[2]){
				$arrow[2][3] = substr($parts[$i],1) / 5;
				$arrow[2][3] = $arrow[2][3] > 10 ? 10 : $arrow[2][3]; // Var range = 0 to 50, default 10
			}
			else if(preg_match('/^s[0-9]+$/', $parts[$i])){
				$arrow[4] = substr($parts[$i],1) / 10;
				$arrow[4] = $arrow[4] > 2 ? 2 : $arrow[4]; // Var range = 0 to 20, default 10
			}
			else{
				$ac_ = parse_col($parts[$i]);
				if($ac_) $arrow[3] = $ac_;
			}
		}
		return $arrow;
	}

	// Insert space in default fd/fc variables
	function insert_space($in, $dim){
		$out = '';
		$dim *= $dim;
		for($i = 0; $i < 6; $i++){
			$out .= substr($in, $dim * $i, $dim) . ' ';
		}
		return $out;
	}


	// -------------------[ 3D Geometry Functions ]--------------------

	// Move point by translation vector
	function translate($p, $t){
		$p[0] += $t[0];
		$p[1] += $t[1];
		$p[2] += $t[2];
		return $p;
	}

	function scale($p, $f){
		$p[0] *= $f;
		$p[1] *= $f;
		$p[2] *= $f;
		return $p;
	}

	// Scale point relative to position vector
	function trans_scale($p, $v, $f){
		// Translate each facelet to cf
		$iv = Array(-$v[0], -$v[1], -$v[2]);
		return translate(scale(translate($p, $iv), $f), $v);
	}

	function rotate($p, $ax, $an){
		$np = Array($p[0], $p[1], $p[2]);
		switch($ax){
			case 0 :
				$np[2] = $p[2] * cos($an) - $p[1] * sin($an);
				$np[1] = $p[2] * sin($an) + $p[1] * cos($an);
				break;
			case 1 :
				$np[0] =   $p[0] * cos($an) + $p[2] * sin($an);
				$np[2] = - $p[0] * sin($an) + $p[2] * cos($an);
				break;
			case 2 :
				$np[0] = $p[0] * cos($an) - $p[1] * sin($an);
				$np[1] = $p[0] * sin($an) + $p[1] * cos($an);
				break;
		}
		return $np;
	}

	// Project 3D points onto a 2D plane
	function project($p, $d){
		return Array(
			$p[0] * $d / $p[2],
			$p[1] * $d / $p[2],
			$p[2] // Maintain z coordinate to allow use of rendering tricks
		);
	}

	// Returns whether a face is visible
	function face_visible($face, $rv){
		return $rv[$face][2] < -0.105;
	}




	// ---------------------------[ Rendering Functions ]----------------------------

	// Returns svg for a cube outline
	function outline_svg($fc){
		global $p, $dim, $cc, $OUTLINE_WIDTH;
		return "\t\t<polygon fill='#$cc' stroke='#$cc' points='".
			$p[$fc][   0][   0][0]*$OUTLINE_WIDTH.','.$p[$fc][   0][   0][1]*$OUTLINE_WIDTH.' '.
			$p[$fc][$dim][   0][0]*$OUTLINE_WIDTH.','.$p[$fc][$dim][   0][1]*$OUTLINE_WIDTH.' '.
			$p[$fc][$dim][$dim][0]*$OUTLINE_WIDTH.','.$p[$fc][$dim][$dim][1]*$OUTLINE_WIDTH.' '.
			$p[$fc][   0][$dim][0]*$OUTLINE_WIDTH.','.$p[$fc][   0][$dim][1]*$OUTLINE_WIDTH."'/>\n";
	}

	// Returns svg for a faces facelets
	function facelet_svg($fc){
		global $p, $dim;
		$svg = '';
		for($i = 0; $i < $dim; $i++){
			for($j = 0; $j < $dim; $j++){
				// Find centre point of facelet // 坐标(x,y,z) 其中z=0
				$cf = Array(($p[$fc][$j  ][$i  ][0] + $p[$fc][$j+1][$i+1][0])/2,
					($p[$fc][$j  ][$i  ][1] + $p[$fc][$j+1][$i+1][1])/2, 0);
				// Scale points in towards centre
				$p1 = trans_scale($p[$fc][$j  ][$i  ], $cf, 0.85);
				$p2 = trans_scale($p[$fc][$j+1][$i  ], $cf, 0.85);
				$p3 = trans_scale($p[$fc][$j+1][$i+1], $cf, 0.85);
				$p4 = trans_scale($p[$fc][$j  ][$i+1], $cf, 0.85);
				// Generate facelet polygon
				$svg .= gen_facelet($p1, $p2, $p3, $p4, $fc * $dim * $dim + $i * $dim + $j);
			}
		}
		return $svg;
	}

	// Renders the top rim of the R U L and B faces out from side of cube
	function oll_svg($fc){
		global $p, $dim, $rv;
		$svg = '';
		// Translation vector, to move faces out
		$tv1 = scale($rv[$fc], 0.00);
		$tv2 = scale($rv[$fc], 0.20);
		$i = 0;
		for($j = 0; $j < $dim; $j++){
				// Find centre point of facelet
				$cf = Array(($p[$fc][$j  ][$i  ][0] + $p[$fc][$j+1][$i+1][0])/2,
					($p[$fc][$j  ][$i  ][1] + $p[$fc][$j+1][$i+1][1])/2, 0);
				// Scale points in towards centre and skew
				$p1 = translate(trans_scale($p[$fc][$j  ][$i  ], $cf, 0.94), $tv1);
				$p2 = translate(trans_scale($p[$fc][$j+1][$i  ], $cf, 0.94), $tv1);
				$p3 = translate(trans_scale($p[$fc][$j+1][$i+1], $cf, 0.94), $tv2);
				$p4 = translate(trans_scale($p[$fc][$j  ][$i+1], $cf, 0.94), $tv2);
				// Generate facelet polygon
				$svg .= gen_facelet($p1, $p2, $p3, $p4, $fc * $dim * $dim + $i * $dim + $j);

		}
		return $svg;
	}

	/** Generates a polygon SVG tag for cube facelets */
	function gen_facelet($p1, $p2, $p3, $p4, $seq){
		global $ABBR_COL, $facelets, $scheme, $using_cols, $cc, $T;
		$fcol = $using_cols ? ($facelets[$seq] == 't' ? 't' : $ABBR_COL[$facelets[$seq]])
		                    : ($facelets[$seq] == $T ? 't' : $scheme[$facelets[$seq]]);
		return "\t\t<polygon fill='#".
			($fcol == 't' ? '000000' : $fcol)."' stroke='#$cc' ".
			($fcol == 't' ? "opacity='0' " : ' ' )."points='".
				$p1[0].','.$p1[1].' '.
				$p2[0].','.$p2[1].' '.
				$p3[0].','.$p3[1].' '.
				$p4[0].','.$p4[1]."'/>\n";
	}

	// Generates svg for an arrow pointing from sticker s1 to s2
	function gen_arrow($id, $s1, $s2, $sv, $sc, $col){
		global $p, $dim;
		if($col == 't') return;
		// Find centre point of each facelet
		$p1 = Array(($p[$s1[0]][$s1[1]][$s1[2]][0] + $p[$s1[0]][$s1[1]+1][$s1[2]+1][0])/2,
			($p[$s1[0]][$s1[1]][$s1[2]][1] + $p[$s1[0]][$s1[1]+1][$s1[2]+1][1])/2, 0);
		$p2 = Array(($p[$s2[0]][$s2[1]][$s2[2]][0] + $p[$s2[0]][$s2[1]+1][$s2[2]+1][0])/2,
			($p[$s2[0]][$s2[1]][$s2[2]][1] + $p[$s2[0]][$s2[1]+1][$s2[2]+1][1])/2, 0);
		// Find midpoint between p1 and p2
		$cp = Array(($p1[0] + $p2[0])/2, ($p1[1] + $p2[1])/2, 0);
		// Shorten arrows towards midpoint according to config
		$p1 = trans_scale($p1, $cp, $sc);
		$p2 = trans_scale($p2, $cp, $sc);
		if($sv){
			$pv = Array(($p[$sv[0]][$sv[1]][$sv[2]][0] + $p[$sv[0]][$sv[1]+1][$sv[2]+1][0])/2,
				($p[$sv[0]][$sv[1]][$sv[2]][1] + $p[$sv[0]][$sv[1]+1][$sv[2]+1][1])/2, 0);
			// Project via point double dist from centre point
			$pv = trans_scale($pv, $cp, $sv[3]);
		}
		// Calculate arrow rotation
		$p_ = $sv ? $pv : $p1;
		$rt = $p_[1] > $p2[1] ? 270 : 90;
		if($p2[0]-$p_[0] != 0){
			$rt = rad2deg(atan(($p2[1]-($p_[1]))/($p2[0]-$p_[0])));
			$rt = ($p_[0] > $p2[0]) ? $rt + 180 : $rt;
		}
		return '		<path d="M '.$p1[0].','.$p1[1].' '.(isset($pv)?'Q '.$pv[0].','.$pv[1]:'L').' '.$p2[0].','.$p2[1].'"
			style="fill:none;stroke:#'.$col.';stroke-opacity:1" />
		<path transform=" translate('.$p2[0].','.$p2[1].') scale('.(0.033 / $dim).') rotate('.$rt.')"
			d="M 5.77,0.0 L -2.88,5.0 L -2.88,-5.0 L 5.77,0.0 z"
			style="fill:#'.$col.';stroke-width:0;stroke-linejoin:round"/>'."\n";
	}

	/** Converts svg into given format */
	function convert($svg, $fmt, $size) {
		global $CONVERT;
		$opts = gen_image_opts($fmt, $size, "svg:-", "$fmt:-");
		$descriptorspec = array(0 => array("pipe", "r"), 1 => array("pipe", "w"));
		$convert = proc_open("$CONVERT $opts", $descriptorspec, $pipes);
		fwrite($pipes[0], $svg);
		fclose($pipes[0]);
		$img = null;
		while(!feof($pipes[1])) {
			$img .= fread($pipes[1], 1024);
		}
		fclose($pipes[1]);
		proc_close($convert);
		return $img;
	}

	/** Alternative version using files rather than pipes,
	not desired because of collision possibilities.. */
	function convert_file($svg, $fmt, $size) {
		global $CONVERT;
		$svgfile = fopen("/tmp/visualcube.svg", 'w');
		fwrite($svgfile, $svg);
		fclose($svgfile);
		$opts = gen_image_opts($fmt, $size, '/tmp/visualcube.svg', "/tmp/visualcube.$fmt");
		$rsvg = exec("$CONVERT $opts");
		$imgfile = fopen("/tmp/visualcube.$fmt", 'r');
		$img = null;
		while($imgfile and !feof($imgfile)) {
			$img .= fread($imgfile, 1024);
		}
		fclose($imgfile);
		return $img;
	}

	/** Generate ImageMagick options depending on format */
	function gen_image_opts($fmt, $size, $infile, $outfile){
		$inopts = ' -density 600 -resize '.$size.'x'.$size;
		$outopts = ' -channel RGBA -alpha set';
//		$opts .= '+label "Generated by VisualCube"';
//		$opts .= ' -comment "Generated by VisualCube"';
//		$opts .= ' -caption "Generated by VisualCube"';
//		$opts = "-gaussian 1";
		switch($fmt){
			case 'png' : $inopts .= " -background none"; $outopts .= " -quality 100 -define png:format=png32";
			break;
			case 'gif' : $inopts .= " -background none";
			break;
			case 'ico' : $inopts .= " -background none";
			break;
			case 'jpg' : $outopts .= " -quality 90";
			break;

		}
		return "$inopts $infile $outopts $outfile";
	}

	/** Sends image to browser */
	function display_img($img, $fmt){
		$mime = $fmt;
		switch($fmt){
			case 'jpe' :
			case 'jpg' : $mime = 'jpeg'; break;
			case 'svg' : $mime = 'svg+xml'; break;
			case 'ico' : $mime = 'vnd.microsoft.icon'; break;
		}
		header("Content-type: image/$mime");
		echo $img;
	}





	// -----------------------------[ DB Access Functions ]--------------------------

	// Return result of sql query as array
	function get_arrays($mysql_con, $query){
		$result = mysqli_query($mysql_con, $query);
		$count = mysqli_num_rows($result);
		if($count <= 0) return null;
		$ary = Array($count);
		$i = 0;
		while($record = mysqli_fetch_array($result, MYSQLI_ASSOC)){
			$ary[$i] = $record;
			$i++;
		}
		return $ary;
	}
?>
